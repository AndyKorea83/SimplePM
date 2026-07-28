// Package usecase holds the application's business logic, decoupled from
// both how project data is stored (internal/repository) and how it is
// exposed (internal/delivery).
package usecase

import (
	"context"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository"
)

// ProjectService exposes project/Gantt data and task mutations to delivery
// layers.
type ProjectService interface {
	GetProject(ctx context.Context) (*entity.Project, error)
	CreateTask(ctx context.Context, input repository.CreateTaskInput) (entity.Task, error)
	UpdateTask(ctx context.Context, uid int, input repository.UpdateTaskInput) (entity.Task, error)
	DeleteTask(ctx context.Context, uid int) error
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

func (s *projectService) GetProject(ctx context.Context) (*entity.Project, error) {
	return s.repo.GetProject(ctx)
}

func (s *projectService) CreateTask(ctx context.Context, input repository.CreateTaskInput) (entity.Task, error) {
	return s.repo.CreateTask(ctx, input)
}

func (s *projectService) UpdateTask(ctx context.Context, uid int, input repository.UpdateTaskInput) (entity.Task, error) {
	return s.repo.UpdateTask(ctx, uid, input)
}

func (s *projectService) DeleteTask(ctx context.Context, uid int) error {
	return s.repo.DeleteTask(ctx, uid)
}
