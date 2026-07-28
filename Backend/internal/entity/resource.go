package entity

// UnassignedResourceUID is the sentinel MSPDI uses on an Assignment's
// ResourceUID when a task has no resource assigned yet.
const UnassignedResourceUID = -65535

// Resource is a person or role that can be assigned to project tasks.
type Resource struct {
	UID      int
	Name     string
	Initials string
	Group    string
	Email    string
}
