package entity

import "time"

// Assignment links a Task to a Resource working on it.
type Assignment struct {
	UID         int
	TaskUID     int
	ResourceUID int
	Units       float64
	Work        time.Duration
}
