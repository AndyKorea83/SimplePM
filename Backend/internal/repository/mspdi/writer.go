package mspdi

import (
	"encoding/xml"
	"fmt"
	"io"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// mspdiNamespace is the XML namespace MSPDI files declare on their root
// <Project> element (see samples/project.xml) — Write reproduces it so the
// exported file looks like a real MSPDI document, even though Parse doesn't
// need it (Go's encoding/xml matches elements by local name).
const mspdiNamespace = "http://schemas.microsoft.com/project"

// Write serializes p as an MSPDI XML document, covering only the fields the
// application actually models (Name/Title/dates/Tasks/Resources/
// Assignments) — not a full MS Project schema clone (Calendars, SaveVersion,
// etc. aren't tracked by entity.Project, so there is nothing real to write
// there). The result round-trips through Parse.
func Write(w io.Writer, p *entity.Project) error {
	doc := fromProject(p)

	if _, err := io.WriteString(w, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+"\n"); err != nil {
		return fmt.Errorf("mspdi: write header: %w", err)
	}
	enc := xml.NewEncoder(w)
	enc.Indent("", "    ")
	if err := enc.Encode(doc); err != nil {
		return fmt.Errorf("mspdi: encode xml: %w", err)
	}
	return nil
}

func fromProject(p *entity.Project) xmlProject {
	tasks := orderedByHierarchy(p.Tasks)
	taskList := make([]xmlTask, 0, len(tasks))
	for _, t := range tasks {
		taskList = append(taskList, fromTask(t))
	}

	resources := make([]xmlResource, 0, len(p.Resources))
	for _, r := range p.Resources {
		resources = append(resources, xmlResource{
			UID:          r.UID,
			Name:         r.Name,
			Initials:     r.Initials,
			Group:        r.Group,
			EmailAddress: r.Email,
		})
	}

	assignments := make([]xmlAssignment, 0, len(p.Assignments))
	for _, a := range p.Assignments {
		assignments = append(assignments, xmlAssignment{
			UID:         a.UID,
			TaskUID:     a.TaskUID,
			ResourceUID: a.ResourceUID,
			Units:       a.Units,
			Work:        formatISODuration(a.Work),
		})
	}

	return xmlProject{
		XMLNS:       mspdiNamespace,
		Name:        p.Name,
		Title:       p.Title,
		StartDate:   formatMspdiTime(p.StartDate),
		FinishDate:  formatMspdiTime(p.FinishDate),
		Tasks:       xmlTasks{Task: taskList},
		Resources:   xmlResources{Resource: resources},
		Assignments: xmlAssignments{Assignment: assignments},
	}
}

func fromTask(t entity.Task) xmlTask {
	links := make([]xmlPredecessorLink, 0, len(t.Dependencies))
	for _, d := range t.Dependencies {
		links = append(links, xmlPredecessorLink{
			PredecessorUID: d.PredecessorUID,
			Type:           int(d.Type),
		})
	}

	return xmlTask{
		UID:             t.UID,
		ID:              t.ID,
		Name:            t.Name,
		WBS:             t.WBS,
		OutlineLevel:    t.OutlineLevel,
		Start:           formatMspdiTime(t.Start),
		Finish:          formatMspdiTime(t.Finish),
		Duration:        formatISODuration(t.Duration),
		PercentComplete: t.PercentComplete,
		Milestone:       intBool(t.IsMilestone),
		Summary:         intBool(t.IsSummary),
		PredecessorLink: links,
	}
}

func formatMspdiTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(mspdiTimeLayout)
}

// formatISODuration is the reverse of parseISODuration: e.g. 88h -> "PT88H0M0S".
func formatISODuration(d time.Duration) string {
	total := int64(d.Round(time.Second) / time.Second)
	hours := total / 3600
	minutes := (total % 3600) / 60
	seconds := total % 60
	return fmt.Sprintf("PT%dH%dM%dS", hours, minutes, seconds)
}

// orderedByHierarchy reorders tasks into depth-first pre-order (each parent
// immediately followed by its children) using ParentUID, keeping siblings in
// their original relative order. Tasks are stored append-only on mutation
// (CreateTask always appends to the end of the slice, wherever its parent
// sits), so the stored order does not generally reflect the tree shape —
// but Parse's assignParentUIDs reconstructs hierarchy purely from document
// order + OutlineLevel, so Write must restore that order or a subsequent
// import would rebuild the wrong tree.
func orderedByHierarchy(tasks []entity.Task) []entity.Task {
	byUID := make(map[int]entity.Task, len(tasks))
	childrenByParent := make(map[int][]int, len(tasks))
	roots := make([]int, 0, len(tasks))
	for _, t := range tasks {
		byUID[t.UID] = t
		if t.ParentUID != nil {
			childrenByParent[*t.ParentUID] = append(childrenByParent[*t.ParentUID], t.UID)
		} else {
			roots = append(roots, t.UID)
		}
	}

	ordered := make([]entity.Task, 0, len(tasks))
	var visit func(uid int)
	visit = func(uid int) {
		ordered = append(ordered, byUID[uid])
		for _, childUID := range childrenByParent[uid] {
			visit(childUID)
		}
	}
	for _, uid := range roots {
		visit(uid)
	}
	return ordered
}
