// Package usecase holds the application's business logic, decoupled from
// both how project data is stored (internal/repository) and how it is
// exposed (internal/delivery).
package usecase

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository/mspdi"
)

// ProjectSummary is the "Проекты" list's per-project view: metadata plus a
// few fields derived from the project's tasks, rather than stored directly.
type ProjectSummary struct {
	Project entity.Project

	// TaskTotal/TaskDone count leaf (non-summary) tasks only — summary/group
	// rows are a rollup of their children, not separate work items, mirroring
	// how the frontend's GanttPage computes its own totals.
	TaskTotal int
	TaskDone  int

	// ComputedFinish is the latest task Finish date in the project (zero if
	// there are no tasks yet), not whatever Project.FinishDate happens to
	// hold — the "Проекты" page shows a deadline derived from actual work.
	ComputedFinish time.Time

	// BehindSchedule is true if at least one incomplete task's Finish date
	// (by calendar day) is already in the past. Same "overdue" criterion as
	// the frontend's Gantt/status.ts::deriveStatus, except it does NOT defer
	// to IsBlocked first — a blocked-and-overdue task still counts as the
	// project being behind schedule.
	BehindSchedule bool
}

// summarize derives a ProjectSummary from a project's current tasks, as of
// now (injected rather than time.Now() so it stays deterministic to test).
func summarize(p entity.Project, now time.Time) ProjectSummary {
	today := truncateToDate(now)
	summary := ProjectSummary{Project: p}

	for _, t := range p.Tasks {
		if t.IsSummary {
			continue
		}
		summary.TaskTotal++
		if t.PercentComplete >= 100 {
			summary.TaskDone++
		}
		if t.Finish.After(summary.ComputedFinish) {
			summary.ComputedFinish = t.Finish
		}
		if t.PercentComplete < 100 && truncateToDate(t.Finish).Before(today) {
			summary.BehindSchedule = true
		}
	}

	return summary
}

func truncateToDate(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// ProjectService exposes project/Gantt data and task mutations to delivery
// layers.
type ProjectService interface {
	GetProject(ctx context.Context, projectID int) (*entity.Project, error)
	ListProjectSummaries(ctx context.Context) ([]ProjectSummary, error)
	CreateProject(ctx context.Context, input repository.CreateProjectInput) (entity.Project, error)
	UpdateProject(ctx context.Context, projectID int, input repository.UpdateProjectInput) (entity.Project, error)
	ImportProject(ctx context.Context, name, description string, file io.Reader) (entity.Project, error)
	ExportProject(ctx context.Context, projectID int) (*entity.Project, error)

	CreateTask(ctx context.Context, projectID int, input repository.CreateTaskInput) (entity.Task, error)
	UpdateTask(ctx context.Context, projectID int, uid int, input repository.UpdateTaskInput) (entity.Task, error)
	DeleteTask(ctx context.Context, projectID int, uid int) error
}

// projectRepository is the minimal contract ProjectService needs — defined
// here, at the point of use, rather than forcing every repository
// implementation (e.g. the read-only mspdi.FileRepository) to satisfy it.
type projectRepository interface {
	repository.ProjectRepository
	repository.TaskRepository
}

type projectService struct {
	repo projectRepository
}

// NewProjectService builds a ProjectService backed by repo.
func NewProjectService(repo projectRepository) ProjectService {
	return &projectService{repo: repo}
}

func (s *projectService) GetProject(ctx context.Context, projectID int) (*entity.Project, error) {
	return s.repo.GetProject(ctx, projectID)
}

func (s *projectService) ListProjectSummaries(ctx context.Context) ([]ProjectSummary, error) {
	projects, err := s.repo.ListProjects(ctx)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	summaries := make([]ProjectSummary, 0, len(projects))
	for _, p := range projects {
		summaries = append(summaries, summarize(p, now))
	}
	return summaries, nil
}

func (s *projectService) CreateProject(ctx context.Context, input repository.CreateProjectInput) (entity.Project, error) {
	return s.repo.CreateProject(ctx, input)
}

func (s *projectService) UpdateProject(ctx context.Context, projectID int, input repository.UpdateProjectInput) (entity.Project, error) {
	return s.repo.UpdateProject(ctx, projectID, input)
}

// ImportProject parses the uploaded MSPDI file (business-level decision: an
// upload is "data", so interpreting its format belongs here, not in the
// HTTP handler) and stores it with the form-supplied name/description.
func (s *projectService) ImportProject(ctx context.Context, name, description string, file io.Reader) (entity.Project, error) {
	parsed, err := mspdi.Parse(file)
	if err != nil {
		return entity.Project{}, fmt.Errorf("import project: %w", err)
	}
	return s.repo.ImportProject(ctx, repository.ImportProjectInput{
		Name:        name,
		Description: description,
		Imported:    parsed,
	})
}

func (s *projectService) ExportProject(ctx context.Context, projectID int) (*entity.Project, error) {
	return s.repo.GetProject(ctx, projectID)
}

func (s *projectService) CreateTask(ctx context.Context, projectID int, input repository.CreateTaskInput) (entity.Task, error) {
	return s.repo.CreateTask(ctx, projectID, input)
}

func (s *projectService) UpdateTask(ctx context.Context, projectID int, uid int, input repository.UpdateTaskInput) (entity.Task, error) {
	return s.repo.UpdateTask(ctx, projectID, uid, input)
}

func (s *projectService) DeleteTask(ctx context.Context, projectID int, uid int) error {
	return s.repo.DeleteTask(ctx, projectID, uid)
}
