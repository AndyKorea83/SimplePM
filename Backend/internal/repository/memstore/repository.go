// Package memstore holds a Project in memory and supports mutating tasks
// on it. It is the stage 1/PoC stand-in for real persistence: the process
// parses the MSPDI file once at startup (see mspdi.FileRepository) and
// hands the result to NewRepository, after which every read and write goes
// through the in-memory copy here. Changes live only for the process's
// lifetime — restarting the server reverts to the XML file's contents.
package memstore

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository"
)

type Repository struct {
	mu                sync.RWMutex
	project           entity.Project
	nextTaskUID       int
	nextAssignmentUID int
}

func NewRepository(initial *entity.Project) *Repository {
	maxTaskUID := 0
	for _, t := range initial.Tasks {
		if t.UID > maxTaskUID {
			maxTaskUID = t.UID
		}
	}
	maxAssignmentUID := 0
	for _, a := range initial.Assignments {
		if a.UID > maxAssignmentUID {
			maxAssignmentUID = a.UID
		}
	}
	r := &Repository{
		project:           *initial,
		nextTaskUID:       maxTaskUID + 1,
		nextAssignmentUID: maxAssignmentUID + 1,
	}
	// MSPDI's own rollup (whatever MS Project computed at export time) isn't
	// necessarily the same number our formula would produce — recompute once
	// up front so summary percentages are correct from the first read, not
	// just after the first mutation anywhere in the tree.
	r.recomputeSummaryProgress()
	return r
}

var (
	_ repository.ProjectRepository = (*Repository)(nil)
	_ repository.TaskRepository    = (*Repository)(nil)
)

func (r *Repository) GetProject(_ context.Context) (*entity.Project, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return cloneProject(&r.project), nil
}

func (r *Repository) CreateTask(_ context.Context, input repository.CreateTaskInput) (entity.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if err := validateRange(input.Start, input.Finish); err != nil {
		return entity.Task{}, err
	}
	if err := r.validateDependencies(r.nextTaskUID, input.Dependencies); err != nil {
		return entity.Task{}, err
	}

	task := entity.Task{
		UID:             r.nextTaskUID,
		ID:              r.nextTaskUID,
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
		parentIndex, err := r.findTaskIndex(*input.ParentUID)
		if err != nil {
			return entity.Task{}, err
		}
		r.project.Tasks[parentIndex].IsSummary = true
		task.OutlineLevel = r.project.Tasks[parentIndex].OutlineLevel + 1
	}
	r.nextTaskUID++

	r.project.Tasks = append(r.project.Tasks, task)
	r.setAssignments(task.UID, input.AssigneeResourceUIDs)
	r.recomputeSummaryProgress()

	return task, nil
}

func (r *Repository) UpdateTask(_ context.Context, uid int, input repository.UpdateTaskInput) (entity.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	index, err := r.findTaskIndex(uid)
	if err != nil {
		return entity.Task{}, err
	}
	task := &r.project.Tasks[index]

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
		if err := r.validateDependencies(uid, *input.Dependencies); err != nil {
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
		r.setAssignments(uid, *input.AssigneeResourceUIDs)
	}
	if input.Dependencies != nil {
		task.Dependencies = append([]entity.Dependency(nil), (*input.Dependencies)...)
	}

	r.recomputeSummaryProgress()

	return *task, nil
}

func (r *Repository) DeleteTask(_ context.Context, uid int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, err := r.findTaskIndex(uid); err != nil {
		return err
	}

	dead := r.collectDescendants(uid)
	dead[uid] = struct{}{}

	remainingTasks := make([]entity.Task, 0, len(r.project.Tasks))
	for _, t := range r.project.Tasks {
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
	r.project.Tasks = remainingTasks

	remainingAssignments := make([]entity.Assignment, 0, len(r.project.Assignments))
	for _, a := range r.project.Assignments {
		if _, isDead := dead[a.TaskUID]; !isDead {
			remainingAssignments = append(remainingAssignments, a)
		}
	}
	r.project.Assignments = remainingAssignments
	r.recomputeSummaryProgress()

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
func (r *Repository) recomputeSummaryProgress() {
	childrenByParent := make(map[int][]int, len(r.project.Tasks))
	indexByUID := make(map[int]int, len(r.project.Tasks))
	for i, t := range r.project.Tasks {
		indexByUID[t.UID] = i
		if t.ParentUID != nil {
			childrenByParent[*t.ParentUID] = append(childrenByParent[*t.ParentUID], t.UID)
		}
	}

	type rollup struct {
		percent int
		weight  float64
	}
	memo := make(map[int]rollup, len(r.project.Tasks))

	var compute func(uid int) rollup
	compute = func(uid int) rollup {
		if v, ok := memo[uid]; ok {
			return v
		}
		task := &r.project.Tasks[indexByUID[uid]]
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

	for _, t := range r.project.Tasks {
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
func (r *Repository) validateDependencies(taskUID int, deps []entity.Dependency) error {
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
		if _, err := r.findTaskIndex(d.PredecessorUID); err != nil {
			return fmt.Errorf("predecessor %d not found", d.PredecessorUID)
		}
	}
	if r.hasDependencyCycle(taskUID, deps) {
		return fmt.Errorf("dependency on task %d would create a cycle", taskUID)
	}
	return nil
}

// hasDependencyCycle checks whether taskUID would become reachable from
// itself if its Dependencies were replaced with proposedDeps, walking every
// other task's *current* predecessor edges unchanged.
func (r *Repository) hasDependencyCycle(taskUID int, proposedDeps []entity.Dependency) bool {
	predecessorsOf := make(map[int][]int, len(r.project.Tasks))
	for _, t := range r.project.Tasks {
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

func (r *Repository) findTaskIndex(uid int) (int, error) {
	for i, t := range r.project.Tasks {
		if t.UID == uid {
			return i, nil
		}
	}
	return -1, fmt.Errorf("task %d not found", uid)
}

// collectDescendants returns the UIDs of every task transitively parented
// under uid (not including uid itself).
func (r *Repository) collectDescendants(uid int) map[int]struct{} {
	childrenByParent := make(map[int][]int)
	for _, t := range r.project.Tasks {
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
func (r *Repository) setAssignments(taskUID int, resourceUIDs []int) {
	filtered := make([]entity.Assignment, 0, len(r.project.Assignments))
	for _, a := range r.project.Assignments {
		if a.TaskUID != taskUID {
			filtered = append(filtered, a)
		}
	}
	for _, resourceUID := range resourceUIDs {
		filtered = append(filtered, entity.Assignment{
			UID:         r.nextAssignmentUID,
			TaskUID:     taskUID,
			ResourceUID: resourceUID,
			Units:       1,
		})
		r.nextAssignmentUID++
	}
	r.project.Assignments = filtered
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
