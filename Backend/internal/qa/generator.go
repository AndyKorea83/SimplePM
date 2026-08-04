// Package qa строит синтетический детерминированный набор данных для
// раздела QA (Kanban-доска/отчёт по багам/история/метрики) — по тому же
// принципу, что internal/timesheet: реальных данных из багтрекера пока
// нет, поэтому набор генерируется один раз при старте процесса.
package qa

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// RangeStart/RangeEnd — тот же 12-месячный охват, что у timesheet (страница
// метрик показывает распределение "с 08.2025 по 07.2026").
var (
	RangeStart = time.Date(2025, time.August, 1, 0, 0, 0, 0, time.UTC)
	RangeEnd   = time.Date(2026, time.July, 31, 0, 0, 0, 0, time.UTC)
)

// placeholderActor — тот же принцип, что memstore.placeholderCreatedBy: в
// приложении нет аутентификации, поэтому "кто передвинул карточку" на
// Kanban-доске — заглушка, а не реальный пользователь.
const placeholderActor = "Текущий пользователь"

// Dataset — не только результат генерации, но и рабочее in-memory
// хранилище на весь жизненный цикл процесса (тот же принцип, что
// memstore.Repository для проекта): перетаскивание карточки на
// Kanban-доске мутирует Bugs/History через UpdateBugStatus, а не только
// читает их.
type Dataset struct {
	mu      sync.RWMutex
	Bugs    []entity.Bug
	History []entity.BugHistoryEntry
}

// Data удовлетворяет qaDataset-интерфейсу usecase.
func (d *Dataset) Data() ([]entity.Bug, []entity.BugHistoryEntry) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return append([]entity.Bug(nil), d.Bugs...), append([]entity.BugHistoryEntry(nil), d.History...)
}

// UpdateBugStatus передвигает баг в новый статус (перетаскивание карточки
// на Kanban-доске) и добавляет соответствующую запись в историю.
func (d *Dataset) UpdateBugStatus(bugUID int, newStatus entity.BugStatus) (entity.Bug, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	for i := range d.Bugs {
		if d.Bugs[i].UID != bugUID {
			continue
		}
		oldStatus := d.Bugs[i].Status
		d.Bugs[i].Status = newStatus
		d.History = append(d.History, entity.BugHistoryEntry{
			BugUID:     bugUID,
			Kind:       entity.HistoryStatusChange,
			At:         time.Now(),
			ByName:     placeholderActor,
			FromStatus: oldStatus,
			ToStatus:   newStatus,
		})
		return d.Bugs[i], nil
	}
	return entity.Bug{}, fmt.Errorf("bug %d not found", bugUID)
}

// Исполнители (разработчики, чинят баги) и репортеры (QA-инженеры, находят
// баги) — два независимых пула людей, как в макете Figma (в Kanban/отчёте
// по багам фигурируют одни имена — Стребков/Петров/Смирнов, — а в
// лидерборде страницы метрик совсем другие — Иванов/Петрова/Сидоров/...).
var assigneeNames = []string{
	"Александр Стребков",
	"Иван Петров",
	"Максим Смирнов",
	"Ольга Гаврилова",
	"Роман Ткачук",
}

var reporterNames = []string{
	"Алексей Иванов",
	"Мария Петрова",
	"Кирилл Сидоров",
	"Наталья Козлова",
	"Дмитрий Михайлов",
	"Софья Селезнева",
}

var themes = []string{
	"SCADAv2",
	"SBGPSv3",
	"Конвейер",
	"Удав",
	"Питон",
	"Термопресс",
	"АСУ-3",
	"Дозатор-М",
}

var statusOrder = []entity.BugStatus{
	entity.StatusToDo,
	entity.StatusInProgress,
	entity.StatusReadyForQA,
	entity.StatusQAInProgress,
	entity.StatusDone,
}

var titlePool = []string{
	"Тестирование авторизации через SSO",
	"Исправить баг с дублированием логов",
	"Подготовить макеты настроек",
	"Тестирование внешних сервисов",
	"Валидация форм регистрации",
	"Верстка писем для уведомлений",
	"Интеграция внешних сервисов",
	"Рефакторинг моделей данных",
	"Оптимизация рендеринга таблиц",
	"Документация API для мобильного",
	"Тестирование платежной системы",
	"Проверка совместимости Safari",
	"Обновление ядра фреймворка",
	"Внутренние инструменты: CI/CD",
	"Интеграция с новым сервисом",
	"Валидация API шлюза",
	"Тестирование API шлюза",
	"Тестирование интеграции Stripe",
	"Тестирование обновлений фреймворка",
	"Ошибка авторизации через SSO",
	"Зависание интерфейса при загрузке файлов",
	"Утечка памяти при удержании websocket",
	"Некорректное отображение таймлайна в Safari",
	"Падение фонового воркера при обработке пустых пакетов",
	"Ошибка валидации контрольной суммы пакета",
	"Неверный формат даты в экспортируемом Excel",
	"Дублирование уведомлений в Telegram",
	"Ошибка при экспорте",
	"Падение при импорте CSV",
	"Таймаут синхронизации",
	"Краш при логине",
	"Не воспроизводится",
	"Неясное поведение API",
	"Нужен доступ к стейджу",
}

// weightedIndex выбирает индекс 0..len(weights)-1 пропорционально весам.
func weightedIndex(r *rand.Rand, weights []int) int {
	total := 0
	for _, w := range weights {
		total += w
	}
	roll := r.Intn(total)
	for i, w := range weights {
		if roll < w {
			return i
		}
		roll -= w
	}
	return len(weights) - 1
}

// buildStatusPath строит последовательность индексов статусов от To Do (0)
// до target включительно. При hasRegression=true путь один раз "отскакивает"
// назад на 1-2 уровня перед тем, как продолжить движение вперёд — имитирует
// баг, не прошедший QA и отправленный на доработку (метрика "Переносы").
func buildStatusPath(target int, hasRegression bool, r *rand.Rand) []int {
	path := []int{0}
	cur := 0
	if hasRegression && target >= 2 {
		bounceAt := 1 + r.Intn(target-1) // где-то посередине пути
		for cur < bounceAt {
			cur++
			path = append(path, cur)
		}
		cur = max(cur-1-r.Intn(2), 0)
		path = append(path, cur)
	}
	for cur < target {
		cur++
		path = append(path, cur)
	}
	return path
}

func randomPersonName(r *rand.Rand, assigneeName, reporterName string) string {
	if r.Intn(2) == 0 {
		return assigneeName
	}
	return reporterName
}

// Generate строит детерминированный набор (фиксированный seed — тот же
// набор при каждом перезапуске процесса, см. internal/timesheet.Generate).
func Generate() *Dataset {
	r := rand.New(rand.NewSource(42))

	severityWeights := []int{15, 30, 25, 20, 10} // trivial..blocker
	severities := []entity.BugSeverity{
		entity.SeverityTrivial, entity.SeverityMinor, entity.SeverityMajor,
		entity.SeverityCritical, entity.SeverityBlocker,
	}
	priorityWeights := []int{15, 45, 30, 10} // Low, Normal, High, Critical
	priorities := []entity.BugPriority{
		entity.PriorityLow, entity.PriorityNormal, entity.PriorityHigh, entity.PriorityCritical,
	}
	statusWeights := []int{28, 24, 12, 12, 24} // To Do..Done

	const bugCount = 62
	const firstUID = 89

	dataset := &Dataset{}
	totalDays := int(RangeEnd.Sub(RangeStart).Hours() / 24)

	for i := range bugCount {
		uid := firstUID + i
		theme := themes[r.Intn(len(themes))]
		assignee := assigneeNames[r.Intn(len(assigneeNames))]
		reporter := reporterNames[r.Intn(len(reporterNames))]
		severity := severities[weightedIndex(r, severityWeights)]
		priority := priorities[weightedIndex(r, priorityWeights)]
		statusIdx := weightedIndex(r, statusWeights)
		status := statusOrder[statusIdx]

		createdAt := RangeStart.AddDate(0, 0, r.Intn(totalDays-14)).Add(time.Duration(r.Intn(10)) * time.Hour)

		isBlocked := false
		isPaused := false
		if status != entity.StatusDone && r.Intn(9) == 0 {
			if r.Intn(2) == 0 {
				isBlocked = true
			} else {
				isPaused = true
			}
		}
		isQuestion := status != entity.StatusDone && !isBlocked && !isPaused && r.Intn(11) == 0

		var deadline *time.Time
		if r.Intn(20) < 9 {
			d := createdAt.AddDate(0, 0, 14+r.Intn(76))
			deadline = &d
		}

		title := titlePool[(uid+i)%len(titlePool)]

		bug := entity.Bug{
			UID:          uid,
			Title:        title,
			Theme:        theme,
			AssigneeName: assignee,
			ReporterName: reporter,
			Status:       status,
			Severity:     severity,
			Priority:     priority,
			IsBlocked:    isBlocked,
			IsPaused:     isPaused,
			IsQuestion:   isQuestion,
			Deadline:     deadline,
			CreatedAt:    createdAt,
		}
		dataset.Bugs = append(dataset.Bugs, bug)

		// История: последовательный путь от To Do до текущего статуса,
		// иногда с одним "отскоком" назад (регрессия после неудачного QA).
		hasRegression := statusIdx >= 2 && r.Intn(4) == 0
		path := buildStatusPath(statusIdx, hasRegression, r)

		at := createdAt
		for step, idx := range path {
			at = at.Add(time.Duration(1+r.Intn(9)) * 24 * time.Hour).Add(time.Duration(r.Intn(10)) * time.Hour)
			from := entity.BugStatus("")
			if step > 0 {
				from = statusOrder[path[step-1]]
			}
			by := randomPersonName(r, assignee, reporter)
			dataset.History = append(dataset.History, entity.BugHistoryEntry{
				BugUID:     uid,
				Kind:       entity.HistoryStatusChange,
				At:         at,
				ByName:     by,
				FromStatus: from,
				ToStatus:   statusOrder[idx],
			})
		}

		if isBlocked || isPaused {
			label := "paused"
			if isBlocked {
				label = "blocked"
			}
			at = at.Add(time.Duration(1+r.Intn(5)) * 24 * time.Hour)
			dataset.History = append(dataset.History, entity.BugHistoryEntry{
				BugUID: uid,
				Kind:   entity.HistoryLabelAdded,
				At:     at,
				ByName: randomPersonName(r, assignee, reporter),
				Label:  label,
			})
		}
	}

	return dataset
}
