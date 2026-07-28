// Package usecase holds the application's business logic, decoupled from
// both how project data is stored (internal/repository) and how it is
// exposed (internal/delivery).
package usecase

import (
	"context"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository"
)

// ProjectService exposes project/Gantt data to delivery layers.
type ProjectService interface {
	GetProject(ctx context.Context) (*entity.Project, error)
}

type projectService struct {
	repo repository.ProjectRepository
}

// NewProjectService builds a ProjectService backed by repo.
func NewProjectService(repo repository.ProjectRepository) ProjectService {
	return &projectService{repo: repo}
}

func (s *projectService) GetProject(ctx context.Context) (*entity.Project, error) {
	return s.repo.GetProject(ctx)
}
