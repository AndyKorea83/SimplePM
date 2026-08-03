package http

import (
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

// The DTOs below are the HTTP API's own view of project data — kept
// separate from entity.* so the domain model never carries JSON tags or
// presentation choices (e.g. hours instead of time.Duration).

type projectDTO struct {
	ID          int             `json:"id"`
	Name        string          `json:"name"`
	Title       string          `json:"title"`
	Description string          `json:"description,omitempty"`
	CreatedBy   string          `json:"createdBy"`
	CreatedAt   string          `json:"createdAt"`
	StartDate   string          `json:"startDate"`
	FinishDate  string          `json:"finishDate"`
	Closed      bool            `json:"closed"`
	ClosedAt    string          `json:"closedAt,omitempty"`
	Tasks       []taskDTO       `json:"tasks"`
	Resources   []resourceDTO   `json:"resources"`
	Assignments []assignmentDTO `json:"assignments"`
}

// projectSummaryDTO — построчное представление списка «Проекты»
// (usecase.ProjectSummary) — без списка задач, странице списка нужны
// только вычисленные сводные поля.
type projectSummaryDTO struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	Title          string `json:"title"`
	Description    string `json:"description,omitempty"`
	CreatedBy      string `json:"createdBy"`
	CreatedAt      string `json:"createdAt"`
	ComputedFinish string `json:"computedFinish"`
	TaskTotal      int    `json:"taskTotal"`
	TaskDone       int    `json:"taskDone"`
	BehindSchedule bool   `json:"behindSchedule"`
	Closed         bool   `json:"closed"`
	ClosedAt       string `json:"closedAt,omitempty"`
}

func newProjectSummaryDTO(s usecase.ProjectSummary) projectSummaryDTO {
	p := s.Project
	return projectSummaryDTO{
		ID:             p.ID,
		Name:           p.Name,
		Title:          p.Title,
		Description:    p.Description,
		CreatedBy:      p.CreatedBy,
		CreatedAt:      formatTime(p.CreatedAt),
		ComputedFinish: formatTime(s.ComputedFinish),
		TaskTotal:      s.TaskTotal,
		TaskDone:       s.TaskDone,
		Closed:         s.Closed,
		ClosedAt:       formatClosedAt(p.ClosedAt),
		BehindSchedule: s.BehindSchedule,
	}
}

type taskDTO struct {
	UID             int             `json:"uid"`
	ID              int             `json:"id"`
	Name            string          `json:"name"`
	WBS             string          `json:"wbs"`
	ParentUID       *int            `json:"parentUid,omitempty"`
	OutlineLevel    int             `json:"outlineLevel"`
	Start           string          `json:"start"`
	Finish          string          `json:"finish"`
	DurationHours   float64         `json:"durationHours"`
	PercentComplete int             `json:"percentComplete"`
	IsMilestone     bool            `json:"isMilestone"`
	IsSummary       bool            `json:"isSummary"`
	IsBlocked       bool            `json:"isBlocked"`
	Dependencies    []dependencyDTO `json:"dependencies,omitempty"`
}

type dependencyDTO struct {
	PredecessorUID int `json:"predecessorUid"`
	Type           int `json:"type"`
}

type resourceDTO struct {
	UID      int    `json:"uid"`
	Name     string `json:"name"`
	Initials string `json:"initials,omitempty"`
	Group    string `json:"group,omitempty"`
	Email    string `json:"email,omitempty"`
}

type assignmentDTO struct {
	UID         int     `json:"uid"`
	TaskUID     int     `json:"taskUid"`
	ResourceUID int     `json:"resourceUid"`
	Units       float64 `json:"units"`
	WorkHours   float64 `json:"workHours"`
}

func newProjectDTO(p *entity.Project) projectDTO {
	tasks := make([]taskDTO, 0, len(p.Tasks))
	for _, t := range p.Tasks {
		tasks = append(tasks, newTaskDTO(t))
	}

	resources := make([]resourceDTO, 0, len(p.Resources))
	for _, r := range p.Resources {
		resources = append(resources, resourceDTO{
			UID:      r.UID,
			Name:     r.Name,
			Initials: r.Initials,
			Group:    r.Group,
			Email:    r.Email,
		})
	}

	assignments := make([]assignmentDTO, 0, len(p.Assignments))
	for _, a := range p.Assignments {
		assignments = append(assignments, assignmentDTO{
			UID:         a.UID,
			TaskUID:     a.TaskUID,
			ResourceUID: a.ResourceUID,
			Units:       a.Units,
			WorkHours:   a.Work.Hours(),
		})
	}

	return projectDTO{
		ID:          p.ID,
		Name:        p.Name,
		Title:       p.Title,
		Description: p.Description,
		CreatedBy:   p.CreatedBy,
		CreatedAt:   formatTime(p.CreatedAt),
		StartDate:   formatTime(p.StartDate),
		FinishDate:  formatTime(p.FinishDate),
		Closed:      p.ClosedAt != nil,
		ClosedAt:    formatClosedAt(p.ClosedAt),
		Tasks:       tasks,
		Resources:   resources,
		Assignments: assignments,
	}
}

func newTaskDTO(t entity.Task) taskDTO {
	deps := make([]dependencyDTO, 0, len(t.Dependencies))
	for _, d := range t.Dependencies {
		deps = append(deps, dependencyDTO{
			PredecessorUID: d.PredecessorUID,
			Type:           int(d.Type),
		})
	}

	return taskDTO{
		UID:             t.UID,
		ID:              t.ID,
		Name:            t.Name,
		WBS:             t.WBS,
		ParentUID:       t.ParentUID,
		OutlineLevel:    t.OutlineLevel,
		Start:           formatTime(t.Start),
		Finish:          formatTime(t.Finish),
		DurationHours:   t.Duration.Hours(),
		PercentComplete: t.PercentComplete,
		IsMilestone:     t.IsMilestone,
		IsSummary:       t.IsSummary,
		IsBlocked:       t.IsBlocked,
		Dependencies:    deps,
	}
}

// The timesheet feature is independent of Project (see internal/timesheet),
// so its DTOs map off usecase.TimesheetMonth rather than entity.*.

type timesheetMonthDTO struct {
	Year        int                    `json:"year"`
	Month       int                    `json:"month"`
	DaysInMonth int                    `json:"daysInMonth"`
	Employees   []timesheetEmployeeDTO `json:"employees"`
}

type timesheetEmployeeDTO struct {
	UID         int                 `json:"uid"`
	Name        string              `json:"name"`
	Team        string              `json:"team"`
	DailyTotals []int               `json:"dailyTotals"`
	TotalHours  int                 `json:"totalHours"`
	Themes      []timesheetThemeDTO `json:"themes"`
}

type timesheetThemeDTO struct {
	UID         int                `json:"uid"`
	Name        string             `json:"name"`
	DailyTotals []int              `json:"dailyTotals"`
	Tasks       []timesheetTaskDTO `json:"tasks"`
}

type timesheetTaskDTO struct {
	UID        int    `json:"uid"`
	Name       string `json:"name"`
	DailyHours []int  `json:"dailyHours"`
}

func newTimesheetMonthDTO(m *usecase.TimesheetMonth) timesheetMonthDTO {
	employees := make([]timesheetEmployeeDTO, 0, len(m.Employees))
	for _, emp := range m.Employees {
		themes := make([]timesheetThemeDTO, 0, len(emp.Themes))
		for _, th := range emp.Themes {
			tasks := make([]timesheetTaskDTO, 0, len(th.Tasks))
			for _, task := range th.Tasks {
				tasks = append(tasks, timesheetTaskDTO{UID: task.UID, Name: task.Name, DailyHours: task.DailyHours})
			}
			themes = append(themes, timesheetThemeDTO{UID: th.UID, Name: th.Name, DailyTotals: th.DailyTotals, Tasks: tasks})
		}
		employees = append(employees, timesheetEmployeeDTO{
			UID:         emp.UID,
			Name:        emp.Name,
			Team:        emp.Team,
			DailyTotals: emp.DailyTotals,
			TotalHours:  emp.TotalHours,
			Themes:      themes,
		})
	}

	return timesheetMonthDTO{
		Year:        m.Year,
		Month:       m.Month,
		DaysInMonth: m.DaysInMonth,
		Employees:   employees,
	}
}

// toDependencies converts request-side DTOs back into entity.Dependency.
// Type numbering mirrors MSPDI's own (FinishToFinish=0, FinishToStart=1,
// StartToFinish=2, StartToStart=3) — NOT alphabetical — so don't "fix" the
// cast below assuming FS=0.
func toDependencies(dtos []dependencyDTO) []entity.Dependency {
	deps := make([]entity.Dependency, 0, len(dtos))
	for _, d := range dtos {
		deps = append(deps, entity.Dependency{
			PredecessorUID: d.PredecessorUID,
			Type:           entity.DependencyType(d.Type),
		})
	}
	return deps
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}

func formatClosedAt(t *time.Time) string {
	if t == nil {
		return ""
	}
	return formatTime(*t)
}
