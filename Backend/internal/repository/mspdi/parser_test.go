package mspdi

import (
	"os"
	"testing"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

func TestParse(t *testing.T) {
	f, err := os.Open("testdata/sample_project.xml")
	if err != nil {
		t.Fatalf("open fixture: %v", err)
	}
	defer f.Close()

	project, err := Parse(f)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	if project.Name != "Fixture" {
		t.Errorf("Name = %q, want %q", project.Name, "Fixture")
	}
	if len(project.Tasks) != 4 {
		t.Fatalf("len(Tasks) = %d, want 4", len(project.Tasks))
	}
	if len(project.Resources) != 2 {
		t.Errorf("len(Resources) = %d, want 2", len(project.Resources))
	}
	if len(project.Assignments) != 2 {
		t.Errorf("len(Assignments) = %d, want 2", len(project.Assignments))
	}

	milestone := project.Tasks[0]
	if !milestone.IsMilestone {
		t.Errorf("task %d IsMilestone = false, want true", milestone.UID)
	}
	if milestone.Duration != 0 {
		t.Errorf("milestone Duration = %v, want 0", milestone.Duration)
	}
	if milestone.IsBlocked {
		t.Error("milestone IsBlocked = true, want false (MSPDI has no source field for it)")
	}

	summary := project.Tasks[1]
	if !summary.IsSummary {
		t.Errorf("task %d IsSummary = false, want true", summary.UID)
	}
	if summary.Duration != 88*time.Hour {
		t.Errorf("summary Duration = %v, want 88h", summary.Duration)
	}

	child := project.Tasks[2]
	if child.ParentUID == nil || *child.ParentUID != summary.UID {
		t.Errorf("child ParentUID = %v, want %d", child.ParentUID, summary.UID)
	}
	if len(child.Dependencies) != 1 || child.Dependencies[0].PredecessorUID != milestone.UID {
		t.Errorf("child Dependencies = %+v, want predecessor %d", child.Dependencies, milestone.UID)
	}
	if child.Dependencies[0].Type != entity.FinishToStart {
		t.Errorf("child Dependency Type = %v, want FinishToStart", child.Dependencies[0].Type)
	}

	closing := project.Tasks[3]
	if closing.ParentUID != nil {
		t.Errorf("closing task ParentUID = %v, want nil (top-level)", closing.ParentUID)
	}

	wantStart, _ := time.Parse(mspdiTimeLayout, "2026-06-15T08:00:00")
	if !milestone.Start.Equal(wantStart) {
		t.Errorf("milestone Start = %v, want %v", milestone.Start, wantStart)
	}

	unassigned := project.Assignments[0]
	if unassigned.ResourceUID != -65535 {
		t.Errorf("assignment ResourceUID = %d, want -65535", unassigned.ResourceUID)
	}

	worked := project.Assignments[1]
	if worked.Work != 88*time.Hour {
		t.Errorf("assignment Work = %v, want 88h", worked.Work)
	}
}

func TestParseISODuration(t *testing.T) {
	cases := []struct {
		in      string
		want    time.Duration
		wantErr bool
	}{
		{"", 0, false},
		{"PT0H0M0S", 0, false},
		{"PT88H0M0S", 88 * time.Hour, false},
		{"PT1H30M0S", time.Hour + 30*time.Minute, false},
		{"P1DT8H0M0S", 24*time.Hour + 8*time.Hour, false},
		{"garbage", 0, true},
	}

	for _, c := range cases {
		got, err := parseISODuration(c.in)
		if (err != nil) != c.wantErr {
			t.Errorf("parseISODuration(%q) error = %v, wantErr %v", c.in, err, c.wantErr)
			continue
		}
		if got != c.want {
			t.Errorf("parseISODuration(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}
