// Package mspdi parses the Microsoft Project XML interchange format
// (MSPDI) into the application's domain entities.
package mspdi

import "encoding/xml"

// The xml* types below are a direct, dumb mapping of the MSPDI schema
// fields we actually use. They carry no behavior — conversion into
// entity.Project happens in mapper.go — so the rest of the app never
// depends on this wire format.

type xmlProject struct {
	XMLName xml.Name `xml:"Project"`
	// XMLNS is only populated by Write (see mspdiNamespace in writer.go) —
	// Go's encoding/xml doesn't emit xmlns from XMLName.Space alone, it needs
	// an explicit "xmlns,attr" field. Parse ignores it either way (matching
	// is by local name), so leaving it empty on decode is harmless.
	XMLNS       string         `xml:"xmlns,attr,omitempty"`
	Name        string         `xml:"Name"`
	Title       string         `xml:"Title"`
	StartDate   string         `xml:"StartDate"`
	FinishDate  string         `xml:"FinishDate"`
	Tasks       xmlTasks       `xml:"Tasks"`
	Resources   xmlResources   `xml:"Resources"`
	Assignments xmlAssignments `xml:"Assignments"`
}

type xmlTasks struct {
	Task []xmlTask `xml:"Task"`
}

type xmlTask struct {
	UID             int                  `xml:"UID"`
	ID              int                  `xml:"ID"`
	Name            string               `xml:"Name"`
	WBS             string               `xml:"WBS"`
	OutlineLevel    int                  `xml:"OutlineLevel"`
	Start           string               `xml:"Start"`
	Finish          string               `xml:"Finish"`
	Duration        string               `xml:"Duration"`
	PercentComplete int                  `xml:"PercentComplete"`
	Milestone       intBool              `xml:"Milestone"`
	Summary         intBool              `xml:"Summary"`
	PredecessorLink []xmlPredecessorLink `xml:"PredecessorLink"`
}

type xmlPredecessorLink struct {
	PredecessorUID int `xml:"PredecessorUID"`
	Type           int `xml:"Type"`
}

type xmlResources struct {
	Resource []xmlResource `xml:"Resource"`
}

type xmlResource struct {
	UID          int    `xml:"UID"`
	Name         string `xml:"Name"`
	Initials     string `xml:"Initials"`
	Group        string `xml:"Group"`
	EmailAddress string `xml:"EmailAddress"`
}

type xmlAssignments struct {
	Assignment []xmlAssignment `xml:"Assignment"`
}

type xmlAssignment struct {
	UID         int     `xml:"UID"`
	TaskUID     int     `xml:"TaskUID"`
	ResourceUID int     `xml:"ResourceUID"`
	Units       float64 `xml:"Units"`
	Work        string  `xml:"Work"`
}

// intBool decodes/encodes MSPDI's "0"/"1" boolean-as-int fields.
type intBool bool

func (b *intBool) UnmarshalText(text []byte) error {
	*b = len(text) > 0 && text[0] == '1'
	return nil
}

func (b intBool) MarshalText() ([]byte, error) {
	if b {
		return []byte("1"), nil
	}
	return []byte("0"), nil
}
