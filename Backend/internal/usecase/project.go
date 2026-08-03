// Package usecase содержит бизнес-логику приложения, отделённую от того,
// как данные проекта хранятся (internal/repository) и как они отдаются
// наружу (internal/delivery).
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

// ProjectSummary — карточное представление проекта для списка «Проекты»:
// метаданные плюс несколько полей, вычисленных из задач проекта, а не
// хранимых напрямую.
type ProjectSummary struct {
	Project entity.Project

	// TaskTotal/TaskDone считают только листовые (не summary) задачи —
	// строки-группы являются роллапом своих детей, а не отдельными
	// единицами работы, аналогично тому, как фронтовый GanttPage считает свои итоги.
	TaskTotal int
	TaskDone  int

	// ComputedFinish — самая поздняя дата Finish среди задач проекта (нулевая,
	// если задач ещё нет), а не то, что хранится в Project.FinishDate —
	// страница «Проекты» показывает срок, вычисленный из реальной работы.
	ComputedFinish time.Time

	// BehindSchedule — true, если хотя бы у одной незавершённой задачи дата
	// Finish (по календарному дню) уже в прошлом. Тот же критерий
	// "просрочено", что у фронтового Gantt/status.ts::deriveStatus, но БЕЗ
	// её приоритета IsBlocked — заблокированная просроченная задача всё
	// равно считается отставанием проекта от графика.
	BehindSchedule bool

	// Closed — вычисляется из Project.ClosedAt (nil -> false), чтобы
	// вызывающей стороне не пришлось знать про entity.Project напрямую.
	Closed bool
}

// summarize вычисляет ProjectSummary по текущим задачам проекта на момент
// now (передаётся параметром, а не берётся из time.Now(), чтобы тест был детерминирован).
func summarize(p entity.Project, now time.Time) ProjectSummary {
	today := truncateToDate(now)
	summary := ProjectSummary{Project: p, Closed: p.ClosedAt != nil}

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

// ProjectService отдаёт данные проекта/Ганта и мутации задач слоям доставки.
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

// projectRepository — минимальный контракт, нужный ProjectService — объявлен
// здесь, в месте использования, а не в пакете repository, чтобы не
// заставлять каждую реализацию (например, read-only mspdi.FileRepository) ему соответствовать.
type projectRepository interface {
	repository.ProjectRepository
	repository.TaskRepository
}

type projectService struct {
	repo projectRepository
}

// NewProjectService строит ProjectService поверх repo.
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

// ImportProject парсит загруженный MSPDI-файл (решение уровня бизнес-логики:
// загруженный файл — это "данные", интерпретация его формата относится сюда,
// а не в HTTP-хендлер) и сохраняет с названием/описанием из формы.
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
