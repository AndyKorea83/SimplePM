// Раздел QA (Kanban-доска, отчёт по багам, история статусов, метрики)
// сознательно независим от entity.Project/Task — это отдельная предметная
// область (по тому же принципу, что и Календарь/timesheet): реальных данных
// из багтрекера пока нет, поэтому исполнитель/репортер — просто строки, а не
// ссылки на entity.Resource.
package entity

import "time"

// BugStatus — колонка Kanban-доски. Есть баги в статусе Done, но сама
// доска их не показывает отдельной колонкой (готовая работа уходит с
// доски) — см. usecase.QAService.ListKanban.
type BugStatus string

const (
	StatusToDo         BugStatus = "To Do"
	StatusInProgress   BugStatus = "In Progress"
	StatusReadyForQA   BugStatus = "Ready for QA"
	StatusQAInProgress BugStatus = "QA in progress"
	StatusDone         BugStatus = "Done"
)

// BugSeverity — техническая серьёзность бага, по возрастанию.
type BugSeverity string

const (
	SeverityTrivial  BugSeverity = "trivial"
	SeverityMinor    BugSeverity = "minor"
	SeverityMajor    BugSeverity = "major"
	SeverityCritical BugSeverity = "critical"
	SeverityBlocker  BugSeverity = "blocker"
)

// BugPriority — важность для бизнеса; независима от Severity (баг может
// быть тривиальным по серьёзности, но приоритетным для конкретного релиза).
type BugPriority string

const (
	PriorityLow      BugPriority = "Low"
	PriorityNormal   BugPriority = "Normal"
	PriorityHigh     BugPriority = "High"
	PriorityCritical BugPriority = "Critical"
)

// Bug — одна задача тестирования/баг.
type Bug struct {
	UID          int
	Title        string
	Theme        string // "Тема" — проект/подсистема (SCADAv2, Конвейер, ...)
	AssigneeName string // исполнитель (разработчик, чинит баг)
	ReporterName string // репортер (QA-инженер, нашёл баг) — отдельный от исполнителя пул людей
	Status       BugStatus
	Severity     BugSeverity
	Priority     BugPriority

	// IsBlocked/IsPaused — независимы от Status (см. architect.md:
	// entity.Task.IsBlocked — тот же принцип, отдельный флаг поверх
	// статуса). На Kanban-доске оба флага уводят карточку в отдельную
	// колонку "Blocked & paused" вне зависимости от Status.
	IsBlocked bool
	IsPaused  bool

	// IsQuestion — задача требует уточнения (для панели "Требует
	// внимания" на странице метрик), не влияет на колонку Kanban.
	IsQuestion bool

	Deadline  *time.Time // nil = дедлайна нет ("-" в таблице)
	CreatedAt time.Time
}

// BugHistoryKind различает два рода событий в истории: смена статуса и
// добавление/снятие метки (Blocked/Paused) — они рендерятся по-разному
// (см. Figma status-history-modal: "X → Y" против "Добавлена метка X").
type BugHistoryKind string

const (
	HistoryStatusChange BugHistoryKind = "status"
	HistoryLabelAdded   BugHistoryKind = "label_added"
	HistoryLabelRemoved BugHistoryKind = "label_removed"
)

// BugHistoryEntry — одно событие в истории бага.
type BugHistoryEntry struct {
	BugUID int
	Kind   BugHistoryKind
	At     time.Time
	ByName string

	// FromStatus/ToStatus заполнены только при Kind == HistoryStatusChange.
	// FromStatus == "" означает "Создано" (первая запись — псевдо-переход в
	// начальный статус, а не реальный статус "до").
	FromStatus BugStatus
	ToStatus   BugStatus

	// Label заполнен только при Kind == HistoryLabelAdded/HistoryLabelRemoved
	// ("blocked" или "paused").
	Label string
}
