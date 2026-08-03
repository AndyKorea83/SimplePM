package usecase

import (
	"testing"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

func TestSummarize(t *testing.T) {
	now := time.Date(2026, time.July, 31, 12, 0, 0, 0, time.UTC)

	t.Run("empty project", func(t *testing.T) {
		got := summarize(entity.Project{}, now)
		if got.TaskTotal != 0 || got.TaskDone != 0 {
			t.Errorf("counts = %d/%d, want 0/0", got.TaskDone, got.TaskTotal)
		}
		if !got.ComputedFinish.IsZero() {
			t.Errorf("ComputedFinish = %v, want zero", got.ComputedFinish)
		}
		if got.BehindSchedule {
			t.Error("BehindSchedule = true, want false")
		}
	})

	t.Run("summary tasks excluded from counts", func(t *testing.T) {
		p := entity.Project{Tasks: []entity.Task{
			{UID: 1, IsSummary: true, PercentComplete: 50},
			{UID: 2, ParentUID: intPtr(1), PercentComplete: 100, Finish: now.AddDate(0, 0, -1)},
			{UID: 3, ParentUID: intPtr(1), PercentComplete: 0, Finish: now.AddDate(0, 0, 5)},
		}}
		got := summarize(p, now)
		if got.TaskTotal != 2 {
			t.Errorf("TaskTotal = %d, want 2 (summary task excluded)", got.TaskTotal)
		}
		if got.TaskDone != 1 {
			t.Errorf("TaskDone = %d, want 1", got.TaskDone)
		}
	})

	t.Run("computed finish is the latest task finish", func(t *testing.T) {
		p := entity.Project{Tasks: []entity.Task{
			{UID: 1, PercentComplete: 100, Finish: now.AddDate(0, 0, -10)},
			{UID: 2, PercentComplete: 100, Finish: now.AddDate(0, 0, 20)},
		}}
		got := summarize(p, now)
		want := now.AddDate(0, 0, 20)
		if !got.ComputedFinish.Equal(want) {
			t.Errorf("ComputedFinish = %v, want %v", got.ComputedFinish, want)
		}
	})

	t.Run("behind schedule: incomplete task past its finish date", func(t *testing.T) {
		p := entity.Project{Tasks: []entity.Task{
			{UID: 1, PercentComplete: 40, Finish: now.AddDate(0, 0, -1)},
		}}
		if !summarize(p, now).BehindSchedule {
			t.Error("BehindSchedule = false, want true")
		}
	})

	t.Run("behind schedule counts a blocked-and-overdue task too", func(t *testing.T) {
		p := entity.Project{Tasks: []entity.Task{
			{UID: 1, PercentComplete: 40, IsBlocked: true, Finish: now.AddDate(0, 0, -1)},
		}}
		if !summarize(p, now).BehindSchedule {
			t.Error("BehindSchedule = false, want true (blocked doesn't exempt from the schedule check)")
		}
	})

	t.Run("not behind schedule: overdue task is already complete", func(t *testing.T) {
		p := entity.Project{Tasks: []entity.Task{
			{UID: 1, PercentComplete: 100, Finish: now.AddDate(0, 0, -1)},
		}}
		if summarize(p, now).BehindSchedule {
			t.Error("BehindSchedule = true, want false (task is done)")
		}
	})

	t.Run("not behind schedule: finish is today", func(t *testing.T) {
		p := entity.Project{Tasks: []entity.Task{
			{UID: 1, PercentComplete: 40, Finish: now},
		}}
		if summarize(p, now).BehindSchedule {
			t.Error("BehindSchedule = true, want false (due today, not yet overdue)")
		}
	})
}

func intPtr(v int) *int { return &v }
