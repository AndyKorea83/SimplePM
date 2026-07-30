package entity

import "time"

// The timesheet/calendar feature is deliberately independent of Project —
// this stage-1 PoC has no real "hours logged per day" data source yet, so
// these are its own employees/tasks rather than reusing entity.Task/Resource.

type TimesheetEmployee struct {
	UID  int
	Name string
	Team string
}

// TimesheetTheme groups a few tasks under one label for one employee (the
// timesheet's equivalent of a parent/epic task).
type TimesheetTheme struct {
	UID         int
	EmployeeUID int
	Name        string
}

type TimesheetTask struct {
	UID      int
	ThemeUID int
	Name     string
}

// TimesheetEntry is the hours logged against one task on one calendar day.
type TimesheetEntry struct {
	TaskUID int
	Date    time.Time
	Hours   int
}
