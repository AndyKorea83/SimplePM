package repository

import (
	"context"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// CreateProjectInput описывает совершенно новый, пустой проект (без задач).
type CreateProjectInput struct {
	Name        string
	Description string
}

// UpdateProjectInput — частичное обновление: nil-поля остаются без изменений.
// Так редактируются только метаданные — даты/счётчики задач вычисляются из
// задач и напрямую не задаются (тот же принцип, что и у summary-задач, см.
// защиту memstore.UpdateTask от прямой правки PercentComplete группы).
// Closed — открыть/закрыть проект (true — закрыть, false — открыть); nil —
// не трогать текущее состояние.
type UpdateProjectInput struct {
	Name        *string
	Description *string
	Closed      *bool
}

// ImportProjectInput описывает проект, создаваемый из загруженного MSPDI XML.
// Imported уже распарсен (через mspdi.Parse, на уровне usecase — этот пакет
// не должен знать формат хранения) и несёт Tasks/Resources/Assignments/даты;
// Name/Description приходят из формы импорта вместо этого и переопределяют
// то, что было в Name/Title самого файла.
type ImportProjectInput struct {
	Name        string
	Description string
	Imported    *entity.Project
}

// ProjectRepository загружает данные проекта для диаграммы Ганта. Этап 1
// реализует его in-memory хранилищем, затравленным из MSPDI XML-файла (см.
// пакет mspdi); Этап 2 предполагает реализацию поверх Gitea/MySQL за тем же
// интерфейсом.
type ProjectRepository interface {
	GetProject(ctx context.Context, projectID int) (*entity.Project, error)
	ListProjects(ctx context.Context) ([]entity.Project, error)
	CreateProject(ctx context.Context, input CreateProjectInput) (entity.Project, error)
	UpdateProject(ctx context.Context, projectID int, input UpdateProjectInput) (entity.Project, error)
	ImportProject(ctx context.Context, input ImportProjectInput) (entity.Project, error)
}
