// Package memstore хранит проекты в памяти и поддерживает мутацию их задач.
// Это PoC-заглушка Этапа 1 вместо настоящей персистентности: процесс
// парсит MSPDI-файл один раз при старте (см. mspdi.FileRepository) и
// передаёт результат в NewRepository как первый проект, после чего каждое
// чтение и запись идёт через in-memory копии здесь — включая проекты,
// созданные или импортированные позже через страницу «Проекты». Изменения
// живут только в течение жизни процесса — перезапуск сервера возвращает
// содержимое затравочного XML-файла (созданные/импортированные проекты теряются).
package memstore

import (
	"context"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository"
)

// placeholderCreatedBy — заглушка вместо "пользователя, создавшего проект",
// пока в приложении нет реальных аккаунтов/аутентификации (Этап 2) — этим
// значением помечается каждый проект, созданный или импортированный через
// это хранилище; это не то, что формы создания/импорта просят ввести вручную.
const placeholderCreatedBy = "Текущий пользователь"

type projectEntry struct {
	project           entity.Project
	nextTaskUID       int
	nextAssignmentUID int
}

type Repository struct {
	mu            sync.RWMutex
	projects      map[int]*projectEntry
	nextProjectID int
}

// NewRepository затравливает хранилище проектом initial с ID 1 (MSPDI-файл,
// загруженный при старте — см. cmd/server/main.go). Остальные проекты
// добавляются через CreateProject/ImportProject.
func NewRepository(initial *entity.Project) *Repository {
	r := &Repository{
		projects:      make(map[int]*projectEntry),
		nextProjectID: 2,
	}
	seed := *initial
	seed.ID = 1
	seed.CreatedBy = placeholderCreatedBy
	seed.CreatedAt = time.Now()
	r.projects[1] = newProjectEntry(seed)
	return r
}

func newProjectEntry(project entity.Project) *projectEntry {
	maxTaskUID := 0
	for _, t := range project.Tasks {
		if t.UID > maxTaskUID {
			maxTaskUID = t.UID
		}
	}
	maxAssignmentUID := 0
	for _, a := range project.Assignments {
		if a.UID > maxAssignmentUID {
			maxAssignmentUID = a.UID
		}
	}
	e := &projectEntry{
		project:           project,
		nextTaskUID:       maxTaskUID + 1,
		nextAssignmentUID: maxAssignmentUID + 1,
	}
	// Собственный роллап MSPDI (что бы MS Project ни посчитал при экспорте)
	// не обязательно совпадает с числом по нашей формуле — пересчитываем
	// сразу же, чтобы проценты групп были верны с первого чтения, а не
	// только после первой мутации где-нибудь в дереве.
	e.recomputeSummaryProgress()
	return e
}

var (
	_ repository.ProjectRepository = (*Repository)(nil)
	_ repository.TaskRepository    = (*Repository)(nil)
)

func (r *Repository) entry(projectID int) (*projectEntry, error) {
	e, ok := r.projects[projectID]
	if !ok {
		return nil, fmt.Errorf("project %d not found", projectID)
	}
	return e, nil
}

func (r *Repository) GetProject(_ context.Context, projectID int) (*entity.Project, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	e, err := r.entry(projectID)
	if err != nil {
		return nil, err
	}
	return cloneProject(&e.project), nil
}

func (r *Repository) ListProjects(_ context.Context) ([]entity.Project, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	projects := make([]entity.Project, 0, len(r.projects))
	for _, e := range r.projects {
		projects = append(projects, *cloneProject(&e.project))
	}
	// Порядок обхода map в Go рандомизирован — без этой сортировки список
	// «Проекты» перемешивался бы на каждый запрос.
	sort.Slice(projects, func(i, j int) bool { return projects[i].ID < projects[j].ID })
	return projects, nil
}

func (r *Repository) CreateProject(_ context.Context, input repository.CreateProjectInput) (entity.Project, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	today := truncateToDate(time.Now())
	project := entity.Project{
		ID:          r.nextProjectID,
		Name:        input.Name,
		Title:       input.Name,
		Description: input.Description,
		CreatedBy:   placeholderCreatedBy,
		CreatedAt:   time.Now(),
		// У совсем нового проекта ещё нет задач — Start/FinishDate всё равно
		// должны быть валидными (не нулевыми): фронтовая сетка Ганта строит
		// диапазон из этих двух полей, когда список задач пуст.
		StartDate:  today,
		FinishDate: today,
	}
	r.projects[r.nextProjectID] = newProjectEntry(project)
	r.nextProjectID++

	return project, nil
}

func (r *Repository) UpdateProject(_ context.Context, projectID int, input repository.UpdateProjectInput) (entity.Project, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	e, err := r.entry(projectID)
	if err != nil {
		return entity.Project{}, err
	}
	if input.Name != nil {
		e.project.Name = *input.Name
		e.project.Title = *input.Name
	}
	if input.Description != nil {
		e.project.Description = *input.Description
	}
	if input.Closed != nil {
		switch {
		case *input.Closed && e.project.ClosedAt == nil:
			now := time.Now()
			e.project.ClosedAt = &now
		case !*input.Closed:
			e.project.ClosedAt = nil
		}
	}
	return e.project, nil
}

func (r *Repository) ImportProject(_ context.Context, input repository.ImportProjectInput) (entity.Project, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	project := *input.Imported
	project.ID = r.nextProjectID
	project.Name = input.Name
	project.Title = input.Name
	project.Description = input.Description
	project.CreatedBy = placeholderCreatedBy
	project.CreatedAt = time.Now()

	r.projects[r.nextProjectID] = newProjectEntry(project)
	r.nextProjectID++

	return project, nil
}

func (r *Repository) CreateTask(_ context.Context, projectID int, input repository.CreateTaskInput) (entity.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	e, err := r.entry(projectID)
	if err != nil {
		return entity.Task{}, err
	}

	if err := validateRange(input.Start, input.Finish); err != nil {
		return entity.Task{}, err
	}
	if err := e.validateDependencies(e.nextTaskUID, input.Dependencies); err != nil {
		return entity.Task{}, err
	}

	task := entity.Task{
		UID:             e.nextTaskUID,
		ID:              e.nextTaskUID,
		Name:            input.Name,
		ParentUID:       input.ParentUID,
		OutlineLevel:    1,
		Start:           input.Start,
		Finish:          input.Finish,
		Duration:        businessDaysDuration(input.Start, input.Finish),
		PercentComplete: input.PercentComplete,
		IsMilestone:     input.IsMilestone,
		IsBlocked:       input.IsBlocked,
		Dependencies:    append([]entity.Dependency(nil), input.Dependencies...),
	}

	if input.ParentUID != nil {
		parentIndex, err := e.findTaskIndex(*input.ParentUID)
		if err != nil {
			return entity.Task{}, err
		}
		e.project.Tasks[parentIndex].IsSummary = true
		task.OutlineLevel = e.project.Tasks[parentIndex].OutlineLevel + 1
	}
	e.nextTaskUID++

	e.project.Tasks = append(e.project.Tasks, task)
	e.setAssignments(task.UID, input.AssigneeResourceUIDs)
	e.recomputeSummaryProgress()

	return task, nil
}

func (r *Repository) UpdateTask(_ context.Context, projectID int, uid int, input repository.UpdateTaskInput) (entity.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	e, err := r.entry(projectID)
	if err != nil {
		return entity.Task{}, err
	}

	index, err := e.findTaskIndex(uid)
	if err != nil {
		return entity.Task{}, err
	}
	task := &e.project.Tasks[index]

	if input.PercentComplete != nil && task.IsSummary {
		return entity.Task{}, fmt.Errorf("percent complete of a summary task is computed automatically from its children and cannot be set directly")
	}

	start, finish := task.Start, task.Finish
	if input.Start != nil {
		start = *input.Start
	}
	if input.Finish != nil {
		finish = *input.Finish
	}
	if err := validateRange(start, finish); err != nil {
		return entity.Task{}, err
	}
	if input.Dependencies != nil {
		if err := e.validateDependencies(uid, *input.Dependencies); err != nil {
			return entity.Task{}, err
		}
	}

	if input.Name != nil {
		task.Name = *input.Name
	}
	task.Start = start
	task.Finish = finish
	// Пересчитываем оценку трудозатрат только если дата реально изменилась —
	// правка, затрагивающая только, например, PercentComplete, не должна
	// попутно молча менять и её.
	if input.Start != nil || input.Finish != nil {
		task.Duration = businessDaysDuration(start, finish)
	}
	if input.PercentComplete != nil {
		task.PercentComplete = *input.PercentComplete
	}
	if input.IsBlocked != nil {
		task.IsBlocked = *input.IsBlocked
	}
	if input.AssigneeResourceUIDs != nil {
		e.setAssignments(uid, *input.AssigneeResourceUIDs)
	}
	if input.Dependencies != nil {
		task.Dependencies = append([]entity.Dependency(nil), (*input.Dependencies)...)
	}

	e.recomputeSummaryProgress()

	return *task, nil
}

func (r *Repository) DeleteTask(_ context.Context, projectID int, uid int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	e, err := r.entry(projectID)
	if err != nil {
		return err
	}

	if _, err := e.findTaskIndex(uid); err != nil {
		return err
	}

	dead := e.collectDescendants(uid)
	dead[uid] = struct{}{}

	remainingTasks := make([]entity.Task, 0, len(e.project.Tasks))
	for _, t := range e.project.Tasks {
		if _, isDead := dead[t.UID]; isDead {
			continue
		}
		// Задачи, ссылавшиеся на удалённую (или её потомков) как на
		// предшественника, теряют эту связь — иначе Dependencies указывал бы
		// на несуществующий UID.
		if len(t.Dependencies) > 0 {
			t.Dependencies = filterDependencies(t.Dependencies, dead)
		}
		remainingTasks = append(remainingTasks, t)
	}
	e.project.Tasks = remainingTasks

	remainingAssignments := make([]entity.Assignment, 0, len(e.project.Assignments))
	for _, a := range e.project.Assignments {
		if _, isDead := dead[a.TaskUID]; !isDead {
			remainingAssignments = append(remainingAssignments, a)
		}
	}
	e.project.Assignments = remainingAssignments
	e.recomputeSummaryProgress()

	return nil
}

// Сравнивает только календарные даты — импортированные/отредактированные
// задачи несут разное время суток (типичный экспорт MSPDI — 08:00 старт/
// 17:00 финиш; правка через дату — 00:00), поэтому однодневная задача не
// должна отклоняться только из-за того, что её finish несёт более раннее время суток.
func validateRange(start, finish time.Time) error {
	if truncateToDate(finish).Before(truncateToDate(start)) {
		return fmt.Errorf("finish %s is before start %s", finish, start)
	}
	return nil
}

const workHoursPerDay = 8

// businessDaysDuration — трудозатраты, подразумеваемые календарным диапазоном
// задачи: один рабочий день (workHoursPerDay часов) за каждый будний день
// (Пн-Пт) во включающем диапазоне [start, finish], выходные исключены.
// Используется при каждой установке/изменении Start/Finish (создание или
// правка), чтобы оценка всегда отражала текущие даты, а не устаревала и не
// засчитывала выходные как рабочие.
func businessDaysDuration(start, finish time.Time) time.Duration {
	s := truncateToDate(start)
	f := truncateToDate(finish)
	if f.Before(s) {
		s, f = f, s
	}
	days := 0
	for d := s; !d.After(f); d = d.AddDate(0, 0, 1) {
		if weekday := d.Weekday(); weekday != time.Saturday && weekday != time.Sunday {
			days++
		}
	}
	return time.Duration(days) * workHoursPerDay * time.Hour
}

func truncateToDate(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// recomputeSummaryProgress пересчитывает PercentComplete для каждой
// summary-задачи по её детям, взвешивая по трудозатратам ребёнка (Duration
// в часах) — ребёнок с большим объёмом работы весит больше в прогрессе
// группы. Ребёнок с нулевой длительностью (например, веха) всё равно
// получает вес 1, чтобы участвовать, а не выпадать из среднего целиком.
// Summary-задачи теперь чистый агрегат (см. защиту UpdateTask от прямой
// правки PercentComplete группы), поэтому это должно выполняться после
// каждой мутации, способной изменить процент листа, даты или саму форму дерева.
func (e *projectEntry) recomputeSummaryProgress() {
	childrenByParent := make(map[int][]int, len(e.project.Tasks))
	indexByUID := make(map[int]int, len(e.project.Tasks))
	for i, t := range e.project.Tasks {
		indexByUID[t.UID] = i
		if t.ParentUID != nil {
			childrenByParent[*t.ParentUID] = append(childrenByParent[*t.ParentUID], t.UID)
		}
	}

	type rollup struct {
		percent int
		weight  float64
	}
	memo := make(map[int]rollup, len(e.project.Tasks))

	var compute func(uid int) rollup
	compute = func(uid int) rollup {
		if v, ok := memo[uid]; ok {
			return v
		}
		task := &e.project.Tasks[indexByUID[uid]]
		children := childrenByParent[uid]
		if len(children) == 0 {
			weight := task.Duration.Hours()
			if weight <= 0 {
				weight = 1
			}
			v := rollup{percent: task.PercentComplete, weight: weight}
			memo[uid] = v
			return v
		}

		var weightedSum, totalWeight float64
		for _, childUID := range children {
			child := compute(childUID)
			weightedSum += float64(child.percent) * child.weight
			totalWeight += child.weight
		}
		if totalWeight > 0 {
			task.PercentComplete = int(math.Round(weightedSum / totalWeight))
		}
		v := rollup{percent: task.PercentComplete, weight: totalWeight}
		memo[uid] = v
		return v
	}

	for _, t := range e.project.Tasks {
		if t.IsSummary {
			compute(t.UID)
		}
	}
}

// filterDependencies убирает любую зависимость, чей UID предшественника есть в dead.
func filterDependencies(deps []entity.Dependency, dead map[int]struct{}) []entity.Dependency {
	filtered := make([]entity.Dependency, 0, len(deps))
	for _, d := range deps {
		if _, isDead := dead[d.PredecessorUID]; !isDead {
			filtered = append(filtered, d)
		}
	}
	return filtered
}

// validateDependencies отклоняет список зависимостей до его записи в taskUID:
// неизвестный/самоссылающийся/дублирующийся предшественник, Type вне
// диапазона (защита от произвольных int из JSON) или цикл.
func (e *projectEntry) validateDependencies(taskUID int, deps []entity.Dependency) error {
	seen := make(map[int]struct{}, len(deps))
	for _, d := range deps {
		if d.PredecessorUID == taskUID {
			return fmt.Errorf("task %d cannot depend on itself", taskUID)
		}
		if d.Type < entity.FinishToFinish || d.Type > entity.StartToStart {
			return fmt.Errorf("invalid dependency type %d", d.Type)
		}
		if _, dup := seen[d.PredecessorUID]; dup {
			return fmt.Errorf("duplicate dependency on predecessor %d", d.PredecessorUID)
		}
		seen[d.PredecessorUID] = struct{}{}
		if _, err := e.findTaskIndex(d.PredecessorUID); err != nil {
			return fmt.Errorf("predecessor %d not found", d.PredecessorUID)
		}
	}
	if e.hasDependencyCycle(taskUID, deps) {
		return fmt.Errorf("dependency on task %d would create a cycle", taskUID)
	}
	return nil
}

// hasDependencyCycle проверяет, станет ли taskUID достижимым из самого себя,
// если её Dependencies заменить на proposedDeps, обходя рёбра предшественников
// всех остальных задач в их *текущем* виде.
func (e *projectEntry) hasDependencyCycle(taskUID int, proposedDeps []entity.Dependency) bool {
	predecessorsOf := make(map[int][]int, len(e.project.Tasks))
	for _, t := range e.project.Tasks {
		if t.UID == taskUID {
			continue
		}
		for _, d := range t.Dependencies {
			predecessorsOf[t.UID] = append(predecessorsOf[t.UID], d.PredecessorUID)
		}
	}
	for _, d := range proposedDeps {
		predecessorsOf[taskUID] = append(predecessorsOf[taskUID], d.PredecessorUID)
	}

	visited := make(map[int]struct{})
	queue := append([]int(nil), predecessorsOf[taskUID]...)
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		if current == taskUID {
			return true
		}
		if _, ok := visited[current]; ok {
			continue
		}
		visited[current] = struct{}{}
		queue = append(queue, predecessorsOf[current]...)
	}
	return false
}

func (e *projectEntry) findTaskIndex(uid int) (int, error) {
	for i, t := range e.project.Tasks {
		if t.UID == uid {
			return i, nil
		}
	}
	return -1, fmt.Errorf("task %d not found", uid)
}

// collectDescendants возвращает UID каждой задачи, транзитивно вложенной
// под uid (сам uid не включается).
func (e *projectEntry) collectDescendants(uid int) map[int]struct{} {
	childrenByParent := make(map[int][]int)
	for _, t := range e.project.Tasks {
		if t.ParentUID != nil {
			childrenByParent[*t.ParentUID] = append(childrenByParent[*t.ParentUID], t.UID)
		}
	}

	descendants := make(map[int]struct{})
	queue := []int{uid}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		for _, child := range childrenByParent[current] {
			if _, seen := descendants[child]; !seen {
				descendants[child] = struct{}{}
				queue = append(queue, child)
			}
		}
	}
	return descendants
}

// setAssignments заменяет все назначения для taskUID на по одному на каждый
// переданный UID ресурса.
func (e *projectEntry) setAssignments(taskUID int, resourceUIDs []int) {
	filtered := make([]entity.Assignment, 0, len(e.project.Assignments))
	for _, a := range e.project.Assignments {
		if a.TaskUID != taskUID {
			filtered = append(filtered, a)
		}
	}
	for _, resourceUID := range resourceUIDs {
		filtered = append(filtered, entity.Assignment{
			UID:         e.nextAssignmentUID,
			TaskUID:     taskUID,
			ResourceUID: resourceUID,
			Units:       1,
		})
		e.nextAssignmentUID++
	}
	e.project.Assignments = filtered
}

func cloneProject(p *entity.Project) *entity.Project {
	clone := *p

	clone.Tasks = make([]entity.Task, len(p.Tasks))
	for i, t := range p.Tasks {
		clone.Tasks[i] = cloneTask(t)
	}
	clone.Resources = append([]entity.Resource(nil), p.Resources...)
	clone.Assignments = append([]entity.Assignment(nil), p.Assignments...)

	return &clone
}

func cloneTask(t entity.Task) entity.Task {
	if t.ParentUID != nil {
		uid := *t.ParentUID
		t.ParentUID = &uid
	}
	t.Dependencies = append([]entity.Dependency(nil), t.Dependencies...)
	return t
}
