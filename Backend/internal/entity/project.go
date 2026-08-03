package entity

import "time"

// Project — весь набор данных диаграммы Ганта для одного проекта.
type Project struct {
	ID          int
	Name        string
	Title       string
	Description string
	// CreatedBy — временная заглушка, пока в приложении нет реальных
	// пользователей/аутентификации (Этап 2) — см. usecase.placeholderCreatedBy.
	CreatedBy  string
	CreatedAt  time.Time
	StartDate  time.Time
	FinishDate time.Time

	// ClosedAt — nil, если проект открыт; иначе момент закрытия. Полноценная
	// история открытий/закрытий (лог событий) — задача на будущее, сейчас
	// хранится только текущее состояние.
	ClosedAt *time.Time

	Tasks       []Task
	Resources   []Resource
	Assignments []Assignment
}
