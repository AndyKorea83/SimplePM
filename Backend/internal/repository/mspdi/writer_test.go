package mspdi

import (
	"bytes"
	"os"
	"testing"
)

// TestWriteParseRoundTrip проверяет, что Write производит документ, который
// Parse читает обратно в эквивалентный проект — именно это свойство и
// нужно экспорту/импорту, поскольку Write обязан восстановить порядок
// документа из ParentUID (см. orderedByHierarchy), иначе иерархия не переживёт round-trip.
func TestWriteParseRoundTrip(t *testing.T) {
	f, err := os.Open("testdata/sample_project.xml")
	if err != nil {
		t.Fatalf("open fixture: %v", err)
	}
	defer f.Close()

	original, err := Parse(f)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	var buf bytes.Buffer
	if err := Write(&buf, original); err != nil {
		t.Fatalf("Write: %v", err)
	}

	roundTripped, err := Parse(&buf)
	if err != nil {
		t.Fatalf("Parse(Write(...)): %v\n--- written xml ---\n%s", err, buf.String())
	}

	if roundTripped.Name != original.Name {
		t.Errorf("Name = %q, want %q", roundTripped.Name, original.Name)
	}
	if len(roundTripped.Tasks) != len(original.Tasks) {
		t.Fatalf("len(Tasks) = %d, want %d", len(roundTripped.Tasks), len(original.Tasks))
	}
	if len(roundTripped.Resources) != len(original.Resources) {
		t.Errorf("len(Resources) = %d, want %d", len(roundTripped.Resources), len(original.Resources))
	}
	if len(roundTripped.Assignments) != len(original.Assignments) {
		t.Errorf("len(Assignments) = %d, want %d", len(roundTripped.Assignments), len(original.Assignments))
	}

	byUID := make(map[int]int, len(roundTripped.Tasks))
	for i, task := range roundTripped.Tasks {
		byUID[task.UID] = i
	}
	for _, wantTask := range original.Tasks {
		i, ok := byUID[wantTask.UID]
		if !ok {
			t.Fatalf("task %d missing after round-trip", wantTask.UID)
		}
		got := roundTripped.Tasks[i]

		wantParent := -1
		if wantTask.ParentUID != nil {
			wantParent = *wantTask.ParentUID
		}
		gotParent := -1
		if got.ParentUID != nil {
			gotParent = *got.ParentUID
		}
		if gotParent != wantParent {
			t.Errorf("task %d ParentUID = %v, want %v", wantTask.UID, gotParent, wantParent)
		}
		if got.IsMilestone != wantTask.IsMilestone {
			t.Errorf("task %d IsMilestone = %v, want %v", wantTask.UID, got.IsMilestone, wantTask.IsMilestone)
		}
		if got.IsSummary != wantTask.IsSummary {
			t.Errorf("task %d IsSummary = %v, want %v", wantTask.UID, got.IsSummary, wantTask.IsSummary)
		}
		if got.Duration != wantTask.Duration {
			t.Errorf("task %d Duration = %v, want %v", wantTask.UID, got.Duration, wantTask.Duration)
		}
		if !got.Start.Equal(wantTask.Start) {
			t.Errorf("task %d Start = %v, want %v", wantTask.UID, got.Start, wantTask.Start)
		}
		if len(got.Dependencies) != len(wantTask.Dependencies) {
			t.Errorf("task %d len(Dependencies) = %d, want %d", wantTask.UID, len(got.Dependencies), len(wantTask.Dependencies))
		}
	}
}

func TestFormatISODuration(t *testing.T) {
	for _, s := range []string{"PT0H0M0S", "PT88H0M0S", "PT1H30M0S"} {
		got, err := parseISODuration(s)
		if err != nil {
			t.Fatalf("parseISODuration(%q): %v", s, err)
		}
		gotBack := formatISODuration(got)
		reparsed, err := parseISODuration(gotBack)
		if err != nil {
			t.Fatalf("parseISODuration(formatISODuration(%q)) = %q: %v", s, gotBack, err)
		}
		if reparsed != got {
			t.Errorf("formatISODuration round-trip: %v -> %q -> %v", got, gotBack, reparsed)
		}
	}
}
