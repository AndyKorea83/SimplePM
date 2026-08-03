package repository

import (
	"context"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// CreateTaskInput describes a new task. ParentUID nil means top-level.
type CreateTaskInput struct {
	Name                 string
	ParentUID            *int
	Start                time.Time
	Finish               time.Time
	PercentComplete      int
	IsMilestone          bool
	IsBlocked            bool
	AssigneeResourceUIDs []int
	Dependencies         []entity.Dependency
}

// UpdateTaskInput is a partial update: nil fields are left unchanged.
type UpdateTaskInput struct {
	Name                 *string
	Start                *time.Time
	Finish               *time.Time
	PercentComplete      *int
	IsBlocked            *bool
	AssigneeResourceUIDs *[]int
	Dependencies         *[]entity.Dependency
}

// TaskRepository mutates tasks within a given project. Only an in-memory-
// backed ProjectRepository (see the memstore package) implements this — the
// MSPDI file repository is read-only and used just for the initial load at
// startup, per the roadmap's stage 1/PoC scope.
type TaskRepository interface {
	CreateTask(ctx context.Context, projectID int, input CreateTaskInput) (entity.Task, error)
	UpdateTask(ctx context.Context, projectID int, uid int, input UpdateTaskInput) (entity.Task, error)
	DeleteTask(ctx context.Context, projectID int, uid int) error
}
