package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// fakeQADataset — простая in-memory реализация qaDataset для тестов, без
// зависимости от internal/qa (usecase-тесты не должны знать про генератор).
type fakeQADataset struct {
	bugs    []entity.Bug
	history []entity.BugHistoryEntry
}

func (f *fakeQADataset) Data() ([]entity.Bug, []entity.BugHistoryEntry) {
	return f.bugs, f.history
}

func (f *fakeQADataset) UpdateBugStatus(bugUID int, newStatus entity.BugStatus) (entity.Bug, error) {
	for i := range f.bugs {
		if f.bugs[i].UID == bugUID {
			old := f.bugs[i].Status
			f.bugs[i].Status = newStatus
			f.history = append(f.history, entity.BugHistoryEntry{
				BugUID: bugUID, Kind: entity.HistoryStatusChange,
				At: time.Now(), FromStatus: old, ToStatus: newStatus,
			})
			return f.bugs[i], nil
		}
	}
	return entity.Bug{}, errBugNotFound
}

var errBugNotFound = errors.New("bug not found")

func TestListKanban_BlockedOverridesStatusColumn(t *testing.T) {
	ds := &fakeQADataset{bugs: []entity.Bug{
		{UID: 1, Status: entity.StatusInProgress, IsBlocked: true},
		{UID: 2, Status: entity.StatusInProgress},
		{UID: 3, Status: entity.StatusDone},
	}}
	svc := NewQAService(ds, time.Now(), time.Now())

	columns, err := svc.ListKanban(context.Background())
	if err != nil {
		t.Fatalf("ListKanban: %v", err)
	}

	byKey := make(map[string]KanbanColumn, len(columns))
	for _, c := range columns {
		byKey[c.Key] = c
	}

	if len(byKey["blocked-paused"].Bugs) != 1 || byKey["blocked-paused"].Bugs[0].UID != 1 {
		t.Errorf("blocked-paused column = %+v, want just bug 1", byKey["blocked-paused"].Bugs)
	}
	if len(byKey["in-progress"].Bugs) != 1 || byKey["in-progress"].Bugs[0].UID != 2 {
		t.Errorf("in-progress column = %+v, want just bug 2 (bug 1 is blocked, bug 3 is Done)", byKey["in-progress"].Bugs)
	}
	for _, c := range columns {
		for _, b := range c.Bugs {
			if b.UID == 3 {
				t.Error("Done bug 3 appears on the Kanban board — Done bugs should be excluded entirely")
			}
		}
	}
}

func TestUpdateBugStatus_AppendsHistory(t *testing.T) {
	ds := &fakeQADataset{bugs: []entity.Bug{{UID: 1, Status: entity.StatusToDo}}}
	svc := NewQAService(ds, time.Now(), time.Now())

	updated, err := svc.UpdateBugStatus(context.Background(), 1, entity.StatusInProgress)
	if err != nil {
		t.Fatalf("UpdateBugStatus: %v", err)
	}
	if updated.Status != entity.StatusInProgress {
		t.Errorf("Status = %q, want In Progress", updated.Status)
	}
	if len(ds.history) != 1 || ds.history[0].ToStatus != entity.StatusInProgress {
		t.Errorf("history = %+v, want one entry to In Progress", ds.history)
	}
}

func TestUpdateBugStatus_RejectsInvalidStatus(t *testing.T) {
	ds := &fakeQADataset{bugs: []entity.Bug{{UID: 1, Status: entity.StatusToDo}}}
	svc := NewQAService(ds, time.Now(), time.Now())

	if _, err := svc.UpdateBugStatus(context.Background(), 1, entity.BugStatus("Nonsense")); err == nil {
		t.Fatal("expected error for invalid status, got nil")
	}
}

func TestGetHistory_OrdersNewestFirstAndComputesLifetime(t *testing.T) {
	created := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	done := created.AddDate(0, 0, 5)
	ds := &fakeQADataset{
		bugs: []entity.Bug{{UID: 1, Status: entity.StatusDone, CreatedAt: created}},
		history: []entity.BugHistoryEntry{
			{BugUID: 1, Kind: entity.HistoryStatusChange, At: created, FromStatus: "", ToStatus: entity.StatusToDo},
			{BugUID: 1, Kind: entity.HistoryStatusChange, At: done, FromStatus: entity.StatusQAInProgress, ToStatus: entity.StatusDone},
		},
	}
	svc := NewQAService(ds, time.Now(), time.Now())

	view, err := svc.GetHistory(context.Background(), 1)
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	if view.TotalChanges != 2 {
		t.Errorf("TotalChanges = %d, want 2", view.TotalChanges)
	}
	if view.Entries[0].ToStatus != entity.StatusDone {
		t.Errorf("Entries[0] (should be newest first) = %+v, want the Done transition", view.Entries[0])
	}
	if view.Lifetime != 5*24*time.Hour {
		t.Errorf("Lifetime = %v, want 5 days (created -> Done transition time)", view.Lifetime)
	}
}

func TestGetMetrics_CountsBySeverityPerMonth(t *testing.T) {
	jan := time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC)
	feb := time.Date(2026, time.February, 15, 0, 0, 0, 0, time.UTC)
	ds := &fakeQADataset{bugs: []entity.Bug{
		{UID: 1, Theme: "A", ReporterName: "R1", Severity: entity.SeverityMajor, CreatedAt: jan, Status: entity.StatusToDo},
		{UID: 2, Theme: "A", ReporterName: "R1", Severity: entity.SeverityBlocker, CreatedAt: jan, Status: entity.StatusToDo},
		{UID: 3, Theme: "B", ReporterName: "R2", Severity: entity.SeverityMinor, CreatedAt: feb, Status: entity.StatusToDo},
	}}
	rangeStart := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	rangeEnd := time.Date(2026, time.February, 28, 0, 0, 0, 0, time.UTC)
	svc := NewQAService(ds, rangeStart, rangeEnd)

	metrics, err := svc.GetMetrics(context.Background(), 2026, time.January)
	if err != nil {
		t.Fatalf("GetMetrics: %v", err)
	}
	if metrics.SelectedMonth.Total != 2 {
		t.Errorf("SelectedMonth.Total = %d, want 2 (jan bugs)", metrics.SelectedMonth.Total)
	}
	if metrics.SelectedMonth.BySeverity[entity.SeverityMajor] != 1 || metrics.SelectedMonth.BySeverity[entity.SeverityBlocker] != 1 {
		t.Errorf("SelectedMonth.BySeverity = %+v, want major=1 blocker=1", metrics.SelectedMonth.BySeverity)
	}
	if len(metrics.MonthlyDistribution) != 2 {
		t.Fatalf("len(MonthlyDistribution) = %d, want 2 (Jan+Feb)", len(metrics.MonthlyDistribution))
	}
	if metrics.MonthlyDistribution[1].Total != 1 {
		t.Errorf("February total = %d, want 1", metrics.MonthlyDistribution[1].Total)
	}
	if metrics.TotalBugs != 3 {
		t.Errorf("TotalBugs = %d, want 3", metrics.TotalBugs)
	}

	if len(metrics.Leaderboard) != 2 || metrics.Leaderboard[0].ReporterName != "R1" || metrics.Leaderboard[0].Total != 2 {
		t.Errorf("Leaderboard = %+v, want R1 first with 2", metrics.Leaderboard)
	}
}

func TestGetMetrics_ProjectStatsLifetimeOnlyCountsClosedBugs(t *testing.T) {
	created := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	doneAt := created.AddDate(0, 0, 10)
	ds := &fakeQADataset{
		bugs: []entity.Bug{
			{UID: 1, Theme: "A", ReporterName: "R", CreatedAt: created, Status: entity.StatusDone},
			{UID: 2, Theme: "A", ReporterName: "R", CreatedAt: created, Status: entity.StatusToDo}, // still open
		},
		history: []entity.BugHistoryEntry{
			{BugUID: 1, Kind: entity.HistoryStatusChange, At: doneAt, FromStatus: entity.StatusQAInProgress, ToStatus: entity.StatusDone},
		},
	}
	svc := NewQAService(ds, time.Now(), time.Now())

	metrics, err := svc.GetMetrics(context.Background(), 2026, time.January)
	if err != nil {
		t.Fatalf("GetMetrics: %v", err)
	}
	if len(metrics.ProjectStats) != 1 {
		t.Fatalf("len(ProjectStats) = %d, want 1", len(metrics.ProjectStats))
	}
	ps := metrics.ProjectStats[0]
	if ps.Created != 2 || ps.Closed != 1 {
		t.Errorf("Created/Closed = %d/%d, want 2/1", ps.Created, ps.Closed)
	}
	if ps.AvgLifetimeDays != 10 || ps.MaxLifetimeDays != 10 {
		t.Errorf("AvgLifetimeDays/MaxLifetimeDays = %v/%v, want 10/10 (only the Done bug counts)", ps.AvgLifetimeDays, ps.MaxLifetimeDays)
	}
}

func TestCountTransfers_CountsBackwardStatusMoves(t *testing.T) {
	history := []entity.BugHistoryEntry{
		{BugUID: 1, Kind: entity.HistoryStatusChange, FromStatus: "", ToStatus: entity.StatusToDo},
		{BugUID: 1, Kind: entity.HistoryStatusChange, FromStatus: entity.StatusToDo, ToStatus: entity.StatusInProgress},
		{BugUID: 1, Kind: entity.HistoryStatusChange, FromStatus: entity.StatusQAInProgress, ToStatus: entity.StatusInProgress}, // backward
		{BugUID: 1, Kind: entity.HistoryStatusChange, FromStatus: entity.StatusInProgress, ToStatus: entity.StatusReadyForQA},
		{BugUID: 1, Kind: entity.HistoryLabelAdded, Label: "blocked"}, // not a status change, must not count
	}
	if got := countTransfers(history, 1); got != 1 {
		t.Errorf("countTransfers = %d, want 1", got)
	}
}
