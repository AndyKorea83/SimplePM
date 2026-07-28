package entity

import "time"

// DependencyType mirrors the MSPDI PredecessorLink/Type values.
type DependencyType int

const (
	FinishToFinish DependencyType = 0
	FinishToStart  DependencyType = 1
	StartToFinish  DependencyType = 2
	StartToStart   DependencyType = 3
)

// Dependency links a task to a predecessor it must respect.
type Dependency struct {
	PredecessorUID int
	Type           DependencyType
}

// Task is a single row of the Gantt chart: a project activity or milestone.
type Task struct {
	UID  int
	ID   int
	Name string
	WBS  string

	// ParentUID is nil for top-level tasks. It is derived from OutlineLevel
	// rather than read directly, since MSPDI expresses hierarchy as a flat,
	// depth-ordered task list rather than explicit parent references.
	ParentUID    *int
	OutlineLevel int

	Start    time.Time
	Finish   time.Time
	Duration time.Duration

	PercentComplete int
	IsMilestone     bool
	IsSummary       bool

	Dependencies []Dependency
}
