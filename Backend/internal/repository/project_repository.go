package repository

import (
	"context"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// CreateProjectInput describes a brand-new, empty project (no tasks yet).
type CreateProjectInput struct {
	Name        string
	Description string
}

// UpdateProjectInput is a partial update: nil fields are left unchanged.
// Only metadata is editable this way — dates/task counts are derived from
// tasks, not settable directly (same principle as summary tasks, see
// memstore.UpdateTask's guard against editing a summary's PercentComplete).
type UpdateProjectInput struct {
	Name        *string
	Description *string
}

// ImportProjectInput describes a project created from an uploaded MSPDI XML
// file. Imported is already parsed (via mspdi.Parse, at the usecase layer —
// this package stays storage-format-agnostic) and supplies
// Tasks/Resources/Assignments/dates; Name/Description come from the import
// form instead and override whatever the file's own Name/Title said.
type ImportProjectInput struct {
	Name        string
	Description string
	Imported    *entity.Project
}

// ProjectRepository loads project data for the Gantt chart. Stage 1 backs it
// with an in-memory store seeded from an MSPDI XML file (see mspdi
// subpackage); stage 2 is expected to add an implementation backed by
// Gitea/MySQL behind this same interface.
type ProjectRepository interface {
	GetProject(ctx context.Context, projectID int) (*entity.Project, error)
	ListProjects(ctx context.Context) ([]entity.Project, error)
	CreateProject(ctx context.Context, input CreateProjectInput) (entity.Project, error)
	UpdateProject(ctx context.Context, projectID int, input UpdateProjectInput) (entity.Project, error)
	ImportProject(ctx context.Context, input ImportProjectInput) (entity.Project, error)
}
