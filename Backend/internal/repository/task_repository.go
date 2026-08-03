package repository

import (
	"context"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// CreateTaskInput описывает новую задачу. ParentUID == nil — задача верхнего уровня.
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

// UpdateTaskInput — частичное обновление: nil-поля остаются без изменений.
type UpdateTaskInput struct {
	Name                 *string
	Start                *time.Time
	Finish               *time.Time
	PercentComplete      *int
	IsBlocked            *bool
	AssigneeResourceUIDs *[]int
	Dependencies         *[]entity.Dependency
}

// TaskRepository мутирует задачи внутри заданного проекта. Реализует его
// только in-memory ProjectRepository (см. пакет memstore) — файловый
// mspdi-репозиторий только для чтения и используется лишь для начальной
// загрузки при старте, согласно PoC-скоупу Этапа 1.
type TaskRepository interface {
	CreateTask(ctx context.Context, projectID int, input CreateTaskInput) (entity.Task, error)
	UpdateTask(ctx context.Context, projectID int, uid int, input UpdateTaskInput) (entity.Task, error)
	DeleteTask(ctx context.Context, projectID int, uid int) error
}
