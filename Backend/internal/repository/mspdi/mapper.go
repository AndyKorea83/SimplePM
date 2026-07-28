package mspdi

import (
	"fmt"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// mspdiTimeLayout matches timestamps like "2026-06-15T08:00:00" — MSPDI
// dates carry no time zone, so they are parsed and kept as UTC.
const mspdiTimeLayout = "2006-01-02T15:04:05"

func parseTime(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}
	t, err := time.Parse(mspdiTimeLayout, s)
	if err != nil {
		return time.Time{}, fmt.Errorf("mspdi: invalid timestamp %q: %w", s, err)
	}
	return t, nil
}

func toProject(x *xmlProject) (*entity.Project, error) {
	start, err := parseTime(x.StartDate)
	if err != nil {
		return nil, err
	}
	finish, err := parseTime(x.FinishDate)
	if err != nil {
		return nil, err
	}

	tasks, err := toTasks(x.Tasks.Task)
	if err != nil {
		return nil, err
	}

	assignments, err := toAssignments(x.Assignments.Assignment)
	if err != nil {
		return nil, err
	}

	return &entity.Project{
		Name:        x.Name,
		Title:       x.Title,
		StartDate:   start,
		FinishDate:  finish,
		Tasks:       tasks,
		Resources:   toResources(x.Resources.Resource),
		Assignments: assignments,
	}, nil
}

func toTasks(in []xmlTask) ([]entity.Task, error) {
	tasks := make([]entity.Task, 0, len(in))
	for _, t := range in {
		start, err := parseTime(t.Start)
		if err != nil {
			return nil, err
		}
		finish, err := parseTime(t.Finish)
		if err != nil {
			return nil, err
		}
		duration, err := parseISODuration(t.Duration)
		if err != nil {
			return nil, err
		}

		var deps []entity.Dependency
		for _, link := range t.PredecessorLink {
			deps = append(deps, entity.Dependency{
				PredecessorUID: link.PredecessorUID,
				Type:           entity.DependencyType(link.Type),
			})
		}

		tasks = append(tasks, entity.Task{
			UID:             t.UID,
			ID:              t.ID,
			Name:            t.Name,
			WBS:             t.WBS,
			OutlineLevel:    t.OutlineLevel,
			Start:           start,
			Finish:          finish,
			Duration:        duration,
			PercentComplete: t.PercentComplete,
			IsMilestone:     bool(t.Milestone),
			IsSummary:       bool(t.Summary),
			Dependencies:    deps,
		})
	}

	assignParentUIDs(tasks)
	return tasks, nil
}

// assignParentUIDs derives each task's ParentUID from the document's
// outline order: MSPDI represents hierarchy as a flat, depth-first list of
// tasks annotated with OutlineLevel rather than explicit parent references.
// A task's parent is the nearest preceding task with a shallower level.
func assignParentUIDs(tasks []entity.Task) {
	type frame struct {
		level int
		uid   int
	}
	var stack []frame

	for i := range tasks {
		level := tasks[i].OutlineLevel
		for len(stack) > 0 && stack[len(stack)-1].level >= level {
			stack = stack[:len(stack)-1]
		}
		if len(stack) > 0 {
			parentUID := stack[len(stack)-1].uid
			tasks[i].ParentUID = &parentUID
		}
		stack = append(stack, frame{level: level, uid: tasks[i].UID})
	}
}

func toResources(in []xmlResource) []entity.Resource {
	resources := make([]entity.Resource, 0, len(in))
	for _, r := range in {
		resources = append(resources, entity.Resource{
			UID:      r.UID,
			Name:     r.Name,
			Initials: r.Initials,
			Group:    r.Group,
			Email:    r.EmailAddress,
		})
	}
	return resources
}

func toAssignments(in []xmlAssignment) ([]entity.Assignment, error) {
	assignments := make([]entity.Assignment, 0, len(in))
	for _, a := range in {
		work, err := parseISODuration(a.Work)
		if err != nil {
			return nil, err
		}
		assignments = append(assignments, entity.Assignment{
			UID:         a.UID,
			TaskUID:     a.TaskUID,
			ResourceUID: a.ResourceUID,
			Units:       a.Units,
			Work:        work,
		})
	}
	return assignments, nil
}
