package entity

import "time"

// Project is the full set of Gantt chart data for a single project.
type Project struct {
	ID          int
	Name        string
	Title       string
	Description string
	// CreatedBy is a stand-in until the app has real users/auth (stage 2) —
	// see usecase.placeholderCreatedBy.
	CreatedBy  string
	CreatedAt  time.Time
	StartDate  time.Time
	FinishDate time.Time

	Tasks       []Task
	Resources   []Resource
	Assignments []Assignment
}
