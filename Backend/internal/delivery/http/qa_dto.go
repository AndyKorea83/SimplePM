package http

import (
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

// DTO раздела QA — вынесены в отдельный файл (не dto.go): раздел
// самостоятельный и достаточно большой (Kanban/отчёт/история/метрики), как
// когда-то timesheet-DTO делили с project-DTO один файл, пока не выросли.

type bugDTO struct {
	UID          int    `json:"uid"`
	Title        string `json:"title"`
	Theme        string `json:"theme"`
	AssigneeName string `json:"assigneeName"`
	ReporterName string `json:"reporterName"`
	Status       string `json:"status"`
	Severity     string `json:"severity"`
	Priority     string `json:"priority"`
	IsBlocked    bool   `json:"isBlocked"`
	IsPaused     bool   `json:"isPaused"`
	IsQuestion   bool   `json:"isQuestion"`
	Deadline     string `json:"deadline,omitempty"`
	CreatedAt    string `json:"createdAt"`
}

func newBugDTO(b entity.Bug) bugDTO {
	deadline := ""
	if b.Deadline != nil {
		deadline = formatTime(*b.Deadline)
	}
	return bugDTO{
		UID:          b.UID,
		Title:        b.Title,
		Theme:        b.Theme,
		AssigneeName: b.AssigneeName,
		ReporterName: b.ReporterName,
		Status:       string(b.Status),
		Severity:     string(b.Severity),
		Priority:     string(b.Priority),
		IsBlocked:    b.IsBlocked,
		IsPaused:     b.IsPaused,
		IsQuestion:   b.IsQuestion,
		Deadline:     deadline,
		CreatedAt:    formatTime(b.CreatedAt),
	}
}

func newBugDTOs(bugs []entity.Bug) []bugDTO {
	dtos := make([]bugDTO, 0, len(bugs))
	for _, b := range bugs {
		dtos = append(dtos, newBugDTO(b))
	}
	return dtos
}

type kanbanColumnDTO struct {
	Key   string   `json:"key"`
	Title string   `json:"title"`
	Bugs  []bugDTO `json:"bugs"`
}

func newKanbanColumnDTOs(columns []usecase.KanbanColumn) []kanbanColumnDTO {
	dtos := make([]kanbanColumnDTO, 0, len(columns))
	for _, c := range columns {
		dtos = append(dtos, kanbanColumnDTO{Key: c.Key, Title: c.Title, Bugs: newBugDTOs(c.Bugs)})
	}
	return dtos
}

type personBugsDTO struct {
	AssigneeName string   `json:"assigneeName"`
	Bugs         []bugDTO `json:"bugs"`
}

func newPersonBugsDTOs(groups []usecase.PersonBugs) []personBugsDTO {
	dtos := make([]personBugsDTO, 0, len(groups))
	for _, g := range groups {
		dtos = append(dtos, personBugsDTO{AssigneeName: g.AssigneeName, Bugs: newBugDTOs(g.Bugs)})
	}
	return dtos
}

type bugHistoryEntryDTO struct {
	Kind       string `json:"kind"`
	At         string `json:"at"`
	ByName     string `json:"byName"`
	FromStatus string `json:"fromStatus,omitempty"`
	ToStatus   string `json:"toStatus,omitempty"`
	Label      string `json:"label,omitempty"`
}

type bugHistoryViewDTO struct {
	Bug           bugDTO               `json:"bug"`
	Entries       []bugHistoryEntryDTO `json:"entries"`
	TotalChanges  int                  `json:"totalChanges"`
	LifetimeDays  int                  `json:"lifetimeDays"`
	LifetimeHours int                  `json:"lifetimeHours"`
}

func newBugHistoryViewDTO(v *usecase.BugHistoryView) bugHistoryViewDTO {
	entries := make([]bugHistoryEntryDTO, 0, len(v.Entries))
	for _, e := range v.Entries {
		entries = append(entries, bugHistoryEntryDTO{
			Kind:       string(e.Kind),
			At:         formatTime(e.At),
			ByName:     e.ByName,
			FromStatus: string(e.FromStatus),
			ToStatus:   string(e.ToStatus),
			Label:      e.Label,
		})
	}
	totalHours := int(v.Lifetime.Hours())
	return bugHistoryViewDTO{
		Bug:           newBugDTO(v.Bug),
		Entries:       entries,
		TotalChanges:  v.TotalChanges,
		LifetimeDays:  totalHours / 24,
		LifetimeHours: totalHours % 24,
	}
}

type monthlySeverityDTO struct {
	Year       int            `json:"year"`
	Month      int            `json:"month"`
	Total      int            `json:"total"`
	BySeverity map[string]int `json:"bySeverity"`
}

func newMonthlySeverityDTO(m usecase.MonthlySeverity) monthlySeverityDTO {
	return monthlySeverityDTO{
		Year:       m.Year,
		Month:      int(m.Month),
		Total:      m.Total,
		BySeverity: severityBreakdownDTO(m.BySeverity),
	}
}

func severityBreakdownDTO(b usecase.SeverityBreakdown) map[string]int {
	out := make(map[string]int, len(b))
	for k, v := range b {
		out[string(k)] = v
	}
	return out
}

type projectStatDTO struct {
	Theme           string  `json:"theme"`
	Created         int     `json:"created"`
	Closed          int     `json:"closed"`
	AvgLifetimeDays float64 `json:"avgLifetimeDays"`
	MaxLifetimeDays float64 `json:"maxLifetimeDays"`
	AvgTransfers    float64 `json:"avgTransfers"`
	MaxTransfers    int     `json:"maxTransfers"`
}

type leaderboardEntryDTO struct {
	ReporterName string         `json:"reporterName"`
	Total        int            `json:"total"`
	BySeverity   map[string]int `json:"bySeverity"`
}

type attentionItemDTO struct {
	Bug   bugDTO `json:"bug"`
	Value string `json:"value"`
}

type qaMetricsDTO struct {
	SelectedMonth       monthlySeverityDTO    `json:"selectedMonth"`
	MonthlyDistribution []monthlySeverityDTO  `json:"monthlyDistribution"`
	TotalBugs           int                   `json:"totalBugs"`
	ProjectStats        []projectStatDTO      `json:"projectStats"`
	Leaderboard         []leaderboardEntryDTO `json:"leaderboard"`
	TooLong             []attentionItemDTO    `json:"tooLong"`
	TooManyTransfers    []attentionItemDTO    `json:"tooManyTransfers"`
	Questions           []bugDTO              `json:"questions"`
}

func newQAMetricsDTO(m *usecase.QAMetrics) qaMetricsDTO {
	distribution := make([]monthlySeverityDTO, 0, len(m.MonthlyDistribution))
	for _, d := range m.MonthlyDistribution {
		distribution = append(distribution, newMonthlySeverityDTO(d))
	}

	stats := make([]projectStatDTO, 0, len(m.ProjectStats))
	for _, s := range m.ProjectStats {
		stats = append(stats, projectStatDTO{
			Theme:           s.Theme,
			Created:         s.Created,
			Closed:          s.Closed,
			AvgLifetimeDays: round2(s.AvgLifetimeDays),
			MaxLifetimeDays: round2(s.MaxLifetimeDays),
			AvgTransfers:    round2(s.AvgTransfers),
			MaxTransfers:    s.MaxTransfers,
		})
	}

	board := make([]leaderboardEntryDTO, 0, len(m.Leaderboard))
	for _, l := range m.Leaderboard {
		board = append(board, leaderboardEntryDTO{
			ReporterName: l.ReporterName,
			Total:        l.Total,
			BySeverity:   severityBreakdownDTO(l.BySeverity),
		})
	}

	tooLong := make([]attentionItemDTO, 0, len(m.TooLong))
	for _, a := range m.TooLong {
		tooLong = append(tooLong, attentionItemDTO{Bug: newBugDTO(a.Bug), Value: a.Value})
	}
	tooManyTransfers := make([]attentionItemDTO, 0, len(m.TooManyTransfers))
	for _, a := range m.TooManyTransfers {
		tooManyTransfers = append(tooManyTransfers, attentionItemDTO{Bug: newBugDTO(a.Bug), Value: a.Value})
	}

	return qaMetricsDTO{
		SelectedMonth:       newMonthlySeverityDTO(m.SelectedMonth),
		MonthlyDistribution: distribution,
		TotalBugs:           m.TotalBugs,
		ProjectStats:        stats,
		Leaderboard:         board,
		TooLong:             tooLong,
		TooManyTransfers:    tooManyTransfers,
		Questions:           newBugDTOs(m.Questions),
	}
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}
