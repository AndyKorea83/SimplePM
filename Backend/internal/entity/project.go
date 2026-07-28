package entity

import "time"

// Project is the full set of Gantt chart data for a single project.
type Project struct {
	Name       string
	Title      string
	StartDate  time.Time
	FinishDate time.Time

	Tasks       []Task
	Resources   []Resource
	Assignments []Assignment
}
