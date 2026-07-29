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
	return &Repository{
		project:           *initial,
		nextTaskUID:       maxTaskUID + 1,
		nextAssignmentUID: maxAssignmentUID + 1,
	}
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
		if _, isDead := dead[t.UID]; !isDead {
			remainingTasks = append(remainingTasks, t)
		}
	}
	r.project.Tasks = remainingTasks

	remainingAssignments := make([]entity.Assignment, 0, len(r.project.Assignments))
	for _, a := range r.project.Assignments {
		if _, isDead := dead[a.TaskUID]; !isDead {
			remainingAssignments = append(remainingAssignments, a)
		}
	}
	r.project.Assignments = remainingAssignments

	return nil
}

func validateRange(start, finish time.Time) error {
	if finish.Before(start) {
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
