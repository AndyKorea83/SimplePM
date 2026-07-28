package repository

import (
	"context"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// ProjectRepository loads project data for the Gantt chart. Stage 1 backs it
// with an MSPDI XML file (see mspdi subpackage); stage 2 is expected to add
// an implementation backed by Gitea/MySQL behind this same interface.
type ProjectRepository interface {
	GetProject(ctx context.Context) (*entity.Project, error)
}
