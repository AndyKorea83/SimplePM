package qa

import (
	"reflect"
	"testing"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

func TestGenerate_Deterministic(t *testing.T) {
	a := Generate()
	b := Generate()
	if len(a.Bugs) != len(b.Bugs) {
		t.Fatalf("len(Bugs) differs across runs: %d vs %d — Generate should be deterministic (fixed seed)", len(a.Bugs), len(b.Bugs))
	}
	for i := range a.Bugs {
		// reflect.DeepEqual, не == — Bug.Deadline это *time.Time, два разных
		// вызова Generate аллоцируют разные указатели даже на одно и то же
		// время, а == для указателей сравнивает адреса, а не значения.
		if !reflect.DeepEqual(a.Bugs[i], b.Bugs[i]) {
			t.Fatalf("bug %d differs across runs:\n%+v\nvs\n%+v", i, a.Bugs[i], b.Bugs[i])
		}
	}
	if !reflect.DeepEqual(a.History, b.History) {
		t.Fatal("History differs across runs — Generate should be deterministic (fixed seed)")
	}
}

func TestGenerate_UniqueUIDs(t *testing.T) {
	d := Generate()
	seen := make(map[int]bool, len(d.Bugs))
	for _, b := range d.Bugs {
		if seen[b.UID] {
			t.Errorf("duplicate bug UID %d", b.UID)
		}
		seen[b.UID] = true
	}
}

func TestGenerate_HistoryStartsAtCreation(t *testing.T) {
	d := Generate()
	firstByBug := make(map[int]entity.BugHistoryEntry)
	for _, h := range d.History {
		if h.Kind != entity.HistoryStatusChange {
			continue
		}
		if _, ok := firstByBug[h.BugUID]; !ok {
			firstByBug[h.BugUID] = h
		}
	}
	for _, b := range d.Bugs {
		first, ok := firstByBug[b.UID]
		if !ok {
			t.Errorf("bug %d has no status history at all", b.UID)
			continue
		}
		if first.FromStatus != "" || first.ToStatus != entity.StatusToDo {
			t.Errorf("bug %d's first history entry = %+v, want FromStatus=\"\" ToStatus=To Do (creation)", b.UID, first)
		}
	}
}

func TestGenerate_HistoryEndsAtBugsCurrentStatus(t *testing.T) {
	d := Generate()
	lastByBug := make(map[int]entity.BugHistoryEntry)
	for _, h := range d.History {
		if h.Kind != entity.HistoryStatusChange {
			continue
		}
		if existing, ok := lastByBug[h.BugUID]; !ok || h.At.After(existing.At) {
			lastByBug[h.BugUID] = h
		}
	}
	for _, b := range d.Bugs {
		last, ok := lastByBug[b.UID]
		if !ok {
			t.Errorf("bug %d has no status history", b.UID)
			continue
		}
		if last.ToStatus != b.Status {
			t.Errorf("bug %d: last history entry reaches %q, want current status %q", b.UID, last.ToStatus, b.Status)
		}
	}
}

func TestGenerate_LabelEventsOnlyForFlaggedBugs(t *testing.T) {
	d := Generate()
	flagged := make(map[int]bool, len(d.Bugs))
	for _, b := range d.Bugs {
		if b.IsBlocked || b.IsPaused {
			flagged[b.UID] = true
		}
	}
	for _, h := range d.History {
		if h.Kind == entity.HistoryLabelAdded && !flagged[h.BugUID] {
			t.Errorf("label_added history entry for bug %d, which isn't flagged blocked/paused", h.BugUID)
		}
	}
}
