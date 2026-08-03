// Package memstore holds projects in memory and supports mutating their
// tasks. It is the stage 1/PoC stand-in for real persistence: the process
// parses the MSPDI file once at startup (see mspdi.FileRepository) and
// hands the result to NewRepository as the first project, after which every
// read and write goes through the in-memory copies here — including
// projects created or imported later through the "Проекты" page. Changes
// live only for the process's lifetime — restarting the server reverts to
// the seed XML file's contents (newly created/imported projects are lost).
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

// placeholderCreatedBy stands in for "the user who created this project"
// until the app has real accounts/auth (stage 2) — every project created or
// imported through this store is stamped with it, not something the create/
// import forms ask the user to type.
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

// NewRepository seeds the store with initial as project ID 1 (the MSPDI
// file loaded at startup — see cmd/server/main.go). Further projects are
// added via CreateProject/ImportProject.
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
	// MSPDI's own rollup (whatever MS Project computed at export time) isn't
	// necessarily the same number our formula would produce — recompute once
	// up front so summary percentages are correct from the first read, not
	// just after the first mutation anywhere in the tree.
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
	// Map iteration order is randomized in Go — without this, the "Проекты"
	// list would reshuffle on every fetch.
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
		// A brand-new project has no tasks yet — Start/FinishDate still need
		// a valid (non-zero) value, since the frontend's Gantt grid builds
		// its date range from these two fields when the task list is empty.
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
	// Only recompute the effort estimate when a date actually moved — an
	// update that only touches e.g. PercentComplete must not silently change
	// it too.
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

// Compares calendar dates only — imported/edited tasks carry inconsistent
// times of day (e.g. MSPDI's typical 08:00 start / 17:00 finish vs. a
// date-only edit landing on midnight), so a same-day task must not be
// rejected just because its finish happens to carry an earlier time value.
func validateRange(start, finish time.Time) error {
	if truncateToDate(finish).Before(truncateToDate(start)) {
		return fmt.Errorf("finish %s is before start %s", finish, start)
	}
	return nil
}

const workHoursPerDay = 8

// businessDaysDuration is the effort implied by a task's calendar span: one
// workHoursPerDay-hour day per weekday (Mon-Fri) in the inclusive
// [start, finish] date range, weekends excluded. Used whenever Start/Finish
// are set or changed (create, or update) so the estimate always reflects
// the current dates instead of going stale or counting weekend days as work.
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

// recomputeSummaryProgress rolls up PercentComplete for every summary task
// from its children, weighted by each child's effort (Duration in hours) —
// a child with more work counts for more of the group's progress. A
// zero-duration child (e.g. a milestone) still gets weight 1 so it
// contributes rather than vanishing from the average entirely. Summary
// tasks are a pure aggregate now (see UpdateTask's guard against editing
// PercentComplete on one directly), so this must run after every mutation
// that could change a leaf's percent, dates, or the tree shape itself.
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

// filterDependencies drops any dependency whose predecessor UID is in dead.
func filterDependencies(deps []entity.Dependency, dead map[int]struct{}) []entity.Dependency {
	filtered := make([]entity.Dependency, 0, len(deps))
	for _, d := range deps {
		if _, isDead := dead[d.PredecessorUID]; !isDead {
			filtered = append(filtered, d)
		}
	}
	return filtered
}

// validateDependencies rejects a dependency list before it is written onto
// taskUID: unknown/self-referencing/duplicate predecessors, an out-of-range
// Type (defends against arbitrary ints arriving from JSON), or a cycle.
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

// hasDependencyCycle checks whether taskUID would become reachable from
// itself if its Dependencies were replaced with proposedDeps, walking every
// other task's *current* predecessor edges unchanged.
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

// collectDescendants returns the UIDs of every task transitively parented
// under uid (not including uid itself).
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

// setAssignments replaces every assignment for taskUID with one per given
// resource UID.
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
