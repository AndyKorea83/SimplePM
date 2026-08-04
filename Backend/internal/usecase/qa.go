package usecase

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// qaDataset — минимальный контракт, нужный QAService от сгенерированного
// набора — объявлен здесь, в месте использования (тот же приём, что
// projectRepository/timesheetDataset).
type qaDataset interface {
	Data() (bugs []entity.Bug, history []entity.BugHistoryEntry)
	UpdateBugStatus(bugUID int, newStatus entity.BugStatus) (entity.Bug, error)
}

// statusOrder — тот же порядок колонок Kanban-доски, что и у генератора
// (internal/qa.Generate) — нужен здесь отдельно, чтобы usecase не зависел
// от internal/qa (только от entity.*).
var statusOrder = []entity.BugStatus{
	entity.StatusToDo,
	entity.StatusInProgress,
	entity.StatusReadyForQA,
	entity.StatusQAInProgress,
	entity.StatusDone,
}

func statusOrdinal(s entity.BugStatus) int {
	for i, v := range statusOrder {
		if v == s {
			return i
		}
	}
	return -1
}

// KanbanColumn — одна колонка доски. "Blocked & paused" — не значение
// entity.BugStatus, а отдельная псевдо-колонка: баг попадает туда по флагу
// IsBlocked/IsPaused независимо от своего реального статуса (см.
// entity.Bug — тот же принцип, что entity.Task.IsBlocked).
type KanbanColumn struct {
	Key   string
	Title string
	Bugs  []entity.Bug
}

// PersonBugs — все баги одного исполнителя (отчёт по багам группирует
// именно по исполнителю, не по репортеру).
type PersonBugs struct {
	AssigneeName string
	Bugs         []entity.Bug
}

// BugHistoryView — история одного бага плюс вычисленные сводные поля
// (модалка "История смены статуса").
type BugHistoryView struct {
	Bug          entity.Bug
	Entries      []entity.BugHistoryEntry // от новых к старым, как в макете
	TotalChanges int
	Lifetime     time.Duration // от создания до Done, либо до "сейчас", если баг ещё открыт
}

// SeverityBreakdown — счётчик багов по каждой серьёзности.
type SeverityBreakdown map[entity.BugSeverity]int

// MonthlySeverity — сводка за один календарный месяц.
type MonthlySeverity struct {
	Year       int
	Month      time.Month
	Total      int
	BySeverity SeverityBreakdown
}

// ProjectStat — строка таблицы "Статистика багов" (группировка по Theme).
type ProjectStat struct {
	Theme           string
	Created         int
	Closed          int
	AvgLifetimeDays float64
	MaxLifetimeDays float64
	AvgTransfers    float64
	MaxTransfers    int
}

// LeaderboardEntry — строка лидерборда (группировка по репортеру — кто
// нашёл больше всего багов, а не кто их исправил).
type LeaderboardEntry struct {
	ReporterName string
	Total        int
	BySeverity   SeverityBreakdown
}

// AttentionItem — одна строка панели "Требует внимания".
type AttentionItem struct {
	Bug   entity.Bug
	Value string // человекочитаемое значение метрики ("12.3 дн.", "2 переноса")
}

// QAMetrics — весь дашборд страницы "Метрики" для одного выбранного месяца.
type QAMetrics struct {
	SelectedMonth       MonthlySeverity
	MonthlyDistribution []MonthlySeverity // 12 месяцев, RangeStart..RangeEnd
	TotalBugs           int
	ProjectStats        []ProjectStat
	Leaderboard         []LeaderboardEntry
	TooLong             []AttentionItem
	TooManyTransfers    []AttentionItem
	Questions           []entity.Bug
}

// QAService — раздел QA (Kanban-доска/отчёт по багам/история/метрики).
type QAService interface {
	ListKanban(ctx context.Context) ([]KanbanColumn, error)
	UpdateBugStatus(ctx context.Context, bugUID int, status entity.BugStatus) (entity.Bug, error)
	ListBugReport(ctx context.Context) ([]PersonBugs, error)
	GetHistory(ctx context.Context, bugUID int) (*BugHistoryView, error)
	GetMetrics(ctx context.Context, year int, month time.Month) (*QAMetrics, error)
}

type qaService struct {
	dataset              qaDataset
	rangeStart, rangeEnd time.Time
}

// NewQAService строит QAService поверх dataset. rangeStart/rangeEnd
// ограничивают помесячное распределение на странице метрик — переданы
// явно (не импортируются из internal/qa), тем же приёмом, что
// usecase.NewTimesheetService(dataset, rangeStart, rangeEnd) для Календаря.
func NewQAService(dataset qaDataset, rangeStart, rangeEnd time.Time) QAService {
	return &qaService{dataset: dataset, rangeStart: rangeStart, rangeEnd: rangeEnd}
}

func (s *qaService) ListKanban(_ context.Context) ([]KanbanColumn, error) {
	bugs, _ := s.dataset.Data()

	columns := []KanbanColumn{
		{Key: "to-do", Title: string(entity.StatusToDo)},
		{Key: "in-progress", Title: string(entity.StatusInProgress)},
		{Key: "ready-for-qa", Title: string(entity.StatusReadyForQA)},
		{Key: "qa-in-progress", Title: string(entity.StatusQAInProgress)},
		{Key: "blocked-paused", Title: "Blocked & paused"},
	}

	for _, b := range bugs {
		if b.Status == entity.StatusDone {
			continue
		}
		idx := 4
		if !b.IsBlocked && !b.IsPaused {
			idx = statusOrdinal(b.Status)
			if idx < 0 || idx > 3 {
				continue
			}
		}
		columns[idx].Bugs = append(columns[idx].Bugs, b)
	}
	return columns, nil
}

func (s *qaService) UpdateBugStatus(_ context.Context, bugUID int, status entity.BugStatus) (entity.Bug, error) {
	if statusOrdinal(status) < 0 {
		return entity.Bug{}, fmt.Errorf("invalid status %q", status)
	}
	return s.dataset.UpdateBugStatus(bugUID, status)
}

func (s *qaService) ListBugReport(_ context.Context) ([]PersonBugs, error) {
	bugs, _ := s.dataset.Data()

	byAssignee := make(map[string][]entity.Bug)
	var order []string
	for _, b := range bugs {
		if _, ok := byAssignee[b.AssigneeName]; !ok {
			order = append(order, b.AssigneeName)
		}
		byAssignee[b.AssigneeName] = append(byAssignee[b.AssigneeName], b)
	}
	sort.Strings(order)

	result := make([]PersonBugs, 0, len(order))
	for _, name := range order {
		result = append(result, PersonBugs{AssigneeName: name, Bugs: byAssignee[name]})
	}
	return result, nil
}

func (s *qaService) GetHistory(_ context.Context, bugUID int) (*BugHistoryView, error) {
	bugs, history := s.dataset.Data()

	var bug *entity.Bug
	for i := range bugs {
		if bugs[i].UID == bugUID {
			bug = &bugs[i]
			break
		}
	}
	if bug == nil {
		return nil, fmt.Errorf("bug %d not found", bugUID)
	}

	var entries []entity.BugHistoryEntry
	for _, h := range history {
		if h.BugUID == bugUID {
			entries = append(entries, h)
		}
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].At.Before(entries[j].At) })

	end := time.Now()
	if bug.Status == entity.StatusDone {
		for _, h := range entries {
			if h.Kind == entity.HistoryStatusChange && h.ToStatus == entity.StatusDone {
				end = h.At
			}
		}
	}
	lifetime := end.Sub(bug.CreatedAt)

	// От новых к старым — как в макете status-history-modal.
	reversed := make([]entity.BugHistoryEntry, len(entries))
	for i, h := range entries {
		reversed[len(entries)-1-i] = h
	}

	return &BugHistoryView{
		Bug:          *bug,
		Entries:      reversed,
		TotalChanges: len(entries),
		Lifetime:     lifetime,
	}, nil
}

// countTransfers — число "откатов" статуса назад в истории бага (баг не
// прошёл QA и был отправлен на доработку) — метрика "Переносы".
func countTransfers(history []entity.BugHistoryEntry, bugUID int) int {
	transfers := 0
	for _, h := range history {
		if h.BugUID != bugUID || h.Kind != entity.HistoryStatusChange || h.FromStatus == "" {
			continue
		}
		if statusOrdinal(h.ToStatus) < statusOrdinal(h.FromStatus) {
			transfers++
		}
	}
	return transfers
}

func emptySeverityBreakdown() SeverityBreakdown {
	return SeverityBreakdown{
		entity.SeverityTrivial:  0,
		entity.SeverityMinor:    0,
		entity.SeverityMajor:    0,
		entity.SeverityCritical: 0,
		entity.SeverityBlocker:  0,
	}
}

func (s *qaService) GetMetrics(_ context.Context, year int, month time.Month) (*QAMetrics, error) {
	bugs, history := s.dataset.Data()

	transfersByBug := make(map[int]int, len(bugs))
	for _, b := range bugs {
		transfersByBug[b.UID] = countTransfers(history, b.UID)
	}
	doneAtByBug := make(map[int]time.Time, len(bugs))
	for _, h := range history {
		if h.Kind == entity.HistoryStatusChange && h.ToStatus == entity.StatusDone {
			doneAtByBug[h.BugUID] = h.At
		}
	}

	// Помесячное распределение по серьёзности, с RangeStart по RangeEnd.
	type monthKey struct {
		year  int
		month time.Month
	}
	byMonth := make(map[monthKey]*MonthlySeverity)
	var monthOrder []monthKey
	for cursor := monthStart(s.rangeStart.Year(), s.rangeStart.Month()); !cursor.After(s.rangeEnd); cursor = cursor.AddDate(0, 1, 0) {
		key := monthKey{cursor.Year(), cursor.Month()}
		monthOrder = append(monthOrder, key)
		byMonth[key] = &MonthlySeverity{Year: key.year, Month: key.month, BySeverity: emptySeverityBreakdown()}
	}

	projectStats := make(map[string]*ProjectStat)
	var projectOrder []string
	leaderboard := make(map[string]*LeaderboardEntry)
	var reporterOrder []string

	for _, b := range bugs {
		key := monthKey{b.CreatedAt.Year(), b.CreatedAt.Month()}
		if m, ok := byMonth[key]; ok {
			m.Total++
			m.BySeverity[b.Severity]++
		}

		if _, ok := projectStats[b.Theme]; !ok {
			projectStats[b.Theme] = &ProjectStat{Theme: b.Theme}
			projectOrder = append(projectOrder, b.Theme)
		}
		ps := projectStats[b.Theme]
		ps.Created++
		if b.Status == entity.StatusDone {
			ps.Closed++
		}

		if _, ok := leaderboard[b.ReporterName]; !ok {
			leaderboard[b.ReporterName] = &LeaderboardEntry{ReporterName: b.ReporterName, BySeverity: emptySeverityBreakdown()}
			reporterOrder = append(reporterOrder, b.ReporterName)
		}
		lb := leaderboard[b.ReporterName]
		lb.Total++
		lb.BySeverity[b.Severity]++
	}

	// Время жизни/переносы — усреднённые только по закрытым багам конкретной
	// темы (у ещё открытого бага "время жизни" не финально).
	lifetimesByTheme := make(map[string][]float64)
	transfersByTheme := make(map[string][]int)
	for _, b := range bugs {
		if doneAt, ok := doneAtByBug[b.UID]; ok {
			days := doneAt.Sub(b.CreatedAt).Hours() / 24
			lifetimesByTheme[b.Theme] = append(lifetimesByTheme[b.Theme], days)
		}
		transfersByTheme[b.Theme] = append(transfersByTheme[b.Theme], transfersByBug[b.UID])
	}
	for _, theme := range projectOrder {
		ps := projectStats[theme]
		if days := lifetimesByTheme[theme]; len(days) > 0 {
			ps.AvgLifetimeDays = average(days)
			ps.MaxLifetimeDays = maxFloat(days)
		}
		if transfers := transfersByTheme[theme]; len(transfers) > 0 {
			floats := make([]float64, len(transfers))
			maxT := 0
			for i, t := range transfers {
				floats[i] = float64(t)
				if t > maxT {
					maxT = t
				}
			}
			ps.AvgTransfers = average(floats)
			ps.MaxTransfers = maxT
		}
	}

	sort.Strings(projectOrder)
	stats := make([]ProjectStat, 0, len(projectOrder))
	for _, theme := range projectOrder {
		stats = append(stats, *projectStats[theme])
	}

	sort.Slice(reporterOrder, func(i, j int) bool {
		return leaderboard[reporterOrder[i]].Total > leaderboard[reporterOrder[j]].Total
	})
	board := make([]LeaderboardEntry, 0, len(reporterOrder))
	for _, name := range reporterOrder {
		board = append(board, *leaderboard[name])
	}

	now := time.Now()
	var tooLong []AttentionItem
	var questions []entity.Bug
	for _, b := range bugs {
		if b.Status == entity.StatusDone {
			continue
		}
		ageDays := now.Sub(b.CreatedAt).Hours() / 24
		if ageDays > 30 {
			tooLong = append(tooLong, AttentionItem{Bug: b, Value: fmt.Sprintf("%.1f дн.", ageDays)})
		}
		if b.IsQuestion {
			questions = append(questions, b)
		}
	}
	sort.Slice(tooLong, func(i, j int) bool {
		return tooLong[i].Bug.CreatedAt.Before(tooLong[j].Bug.CreatedAt)
	})
	if len(tooLong) > 5 {
		tooLong = tooLong[:5]
	}

	var tooManyTransfers []AttentionItem
	for _, b := range bugs {
		if t := transfersByBug[b.UID]; t >= 1 {
			word := "перенос"
			switch {
			case t%10 >= 2 && t%10 <= 4 && (t%100 < 10 || t%100 >= 20):
				word = "переноса"
			case t%10 == 1 && t%100 != 11:
				word = "перенос"
			default:
				word = "переносов"
			}
			tooManyTransfers = append(tooManyTransfers, AttentionItem{Bug: b, Value: fmt.Sprintf("%d %s", t, word)})
		}
	}
	sort.Slice(tooManyTransfers, func(i, j int) bool {
		return transfersByBug[tooManyTransfers[i].Bug.UID] > transfersByBug[tooManyTransfers[j].Bug.UID]
	})
	if len(tooManyTransfers) > 5 {
		tooManyTransfers = tooManyTransfers[:5]
	}

	selected := MonthlySeverity{Year: year, Month: month, BySeverity: emptySeverityBreakdown()}
	if m, ok := byMonth[monthKey{year, month}]; ok {
		selected = *m
	}

	distribution := make([]MonthlySeverity, 0, len(monthOrder))
	for _, key := range monthOrder {
		distribution = append(distribution, *byMonth[key])
	}

	return &QAMetrics{
		SelectedMonth:       selected,
		MonthlyDistribution: distribution,
		TotalBugs:           len(bugs),
		ProjectStats:        stats,
		Leaderboard:         board,
		TooLong:             tooLong,
		TooManyTransfers:    tooManyTransfers,
		Questions:           questions,
	}, nil
}

func average(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	var sum float64
	for _, x := range xs {
		sum += x
	}
	return sum / float64(len(xs))
}

func maxFloat(xs []float64) float64 {
	m := xs[0]
	for _, x := range xs[1:] {
		if x > m {
			m = x
		}
	}
	return m
}

func monthStart(year int, month time.Month) time.Time {
	return time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
}
