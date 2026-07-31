package memstore

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository"
)

func testProject() *entity.Project {
	start := time.Date(2026, 6, 1, 8, 0, 0, 0, time.UTC)
	finish := time.Date(2026, 6, 10, 17, 0, 0, 0, time.UTC)
	return &entity.Project{
		Name: "Test",
		Tasks: []entity.Task{
			{UID: 1, ID: 1, Name: "Existing", OutlineLevel: 1, Start: start, Finish: finish},
			{UID: 5, ID: 5, Name: "Existing 5", OutlineLevel: 1, Start: start, Finish: finish},
		},
		Resources: []entity.Resource{
			{UID: 1, Name: "Alice"},
			{UID: 2, Name: "Bob"},
		},
		Assignments: []entity.Assignment{
			{UID: 3, TaskUID: 1, ResourceUID: 1, Units: 1},
		},
	}
}

func TestCreateTask_TopLevel(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()

	task, err := repo.CreateTask(ctx, repository.CreateTaskInput{
		Name:   "New task",
		Start:  time.Date(2026, 7, 1, 8, 0, 0, 0, time.UTC),
		Finish: time.Date(2026, 7, 5, 17, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if task.UID != 6 {
		t.Errorf("UID = %d, want 6 (max existing UID 5 + 1)", task.UID)
	}
	if task.ParentUID != nil {
		t.Errorf("ParentUID = %v, want nil", task.ParentUID)
	}
	if task.OutlineLevel != 1 {
		t.Errorf("OutlineLevel = %d, want 1", task.OutlineLevel)
	}

	project, err := repo.GetProject(ctx)
	if err != nil {
		t.Fatalf("GetProject: %v", err)
	}
	if len(project.Tasks) != 3 {
		t.Fatalf("len(Tasks) = %d, want 3", len(project.Tasks))
	}
}

func TestCreateTask_WithParentMarksParentSummary(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()
	parentUID := 1

	child, err := repo.CreateTask(ctx, repository.CreateTaskInput{
		Name:      "Child",
		ParentUID: &parentUID,
		Start:     time.Date(2026, 6, 2, 8, 0, 0, 0, time.UTC),
		Finish:    time.Date(2026, 6, 3, 17, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if child.OutlineLevel != 2 {
		t.Errorf("child OutlineLevel = %d, want 2", child.OutlineLevel)
	}

	project, _ := repo.GetProject(ctx)
	var parent *entity.Task
	for i := range project.Tasks {
		if project.Tasks[i].UID == parentUID {
			parent = &project.Tasks[i]
		}
	}
	if parent == nil {
		t.Fatal("parent task not found")
	}
	if !parent.IsSummary {
		t.Error("parent.IsSummary = false, want true after gaining a child")
	}
}

func TestSummaryProgress_WeightedRollupFromChildren(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()
	parentUID := 1

	// Child A: 1 business day (Mon 2026-06-15), 100% complete.
	if _, err := repo.CreateTask(ctx, repository.CreateTaskInput{
		Name:            "A",
		ParentUID:       &parentUID,
		Start:           time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC),
		Finish:          time.Date(2026, 6, 15, 17, 0, 0, 0, time.UTC),
		PercentComplete: 100,
	}); err != nil {
		t.Fatalf("CreateTask A: %v", err)
	}
	// Child B: 3 business days (Mon-Wed), 0% complete — 3x the weight of A,
	// so the rollup should be much closer to B's 0% than a plain average.
	if _, err := repo.CreateTask(ctx, repository.CreateTaskInput{
		Name:            "B",
		ParentUID:       &parentUID,
		Start:           time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC),
		Finish:          time.Date(2026, 6, 17, 17, 0, 0, 0, time.UTC),
		PercentComplete: 0,
	}); err != nil {
		t.Fatalf("CreateTask B: %v", err)
	}

	project, _ := repo.GetProject(ctx)
	var parent *entity.Task
	for i := range project.Tasks {
		if project.Tasks[i].UID == parentUID {
			parent = &project.Tasks[i]
		}
	}
	if parent == nil {
		t.Fatal("parent task not found")
	}
	// weighted: (100*1 + 0*3) / (1+3) = 25
	if parent.PercentComplete != 25 {
		t.Errorf("parent.PercentComplete = %d, want 25 (weighted by effort)", parent.PercentComplete)
	}
}

func TestSummaryProgress_RecomputesWhenChildChanges(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()
	parentUID := 1

	child, err := repo.CreateTask(ctx, repository.CreateTaskInput{
		Name:            "Only child",
		ParentUID:       &parentUID,
		Start:           time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC),
		Finish:          time.Date(2026, 6, 15, 17, 0, 0, 0, time.UTC),
		PercentComplete: 0,
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	newPercent := 100
	if _, err := repo.UpdateTask(ctx, child.UID, repository.UpdateTaskInput{PercentComplete: &newPercent}); err != nil {
		t.Fatalf("UpdateTask child: %v", err)
	}

	project, _ := repo.GetProject(ctx)
	var parent *entity.Task
	for i := range project.Tasks {
		if project.Tasks[i].UID == parentUID {
			parent = &project.Tasks[i]
		}
	}
	if parent == nil {
		t.Fatal("parent task not found")
	}
	if parent.PercentComplete != 100 {
		t.Errorf("parent.PercentComplete = %d, want 100 after its only child reached 100%%", parent.PercentComplete)
	}
}

func TestUpdateTask_SummaryPercentCompleteRejected(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()
	parentUID := 1

	if _, err := repo.CreateTask(ctx, repository.CreateTaskInput{
		Name:      "Child",
		ParentUID: &parentUID,
		Start:     time.Now(),
		Finish:    time.Now(),
	}); err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	newPercent := 50
	if _, err := repo.UpdateTask(ctx, parentUID, repository.UpdateTaskInput{PercentComplete: &newPercent}); err == nil {
		t.Fatal("expected error setting PercentComplete directly on a summary task, got nil")
	}
}

func TestCreateTask_UnknownParent(t *testing.T) {
	repo := NewRepository(testProject())
	missing := 999

	_, err := repo.CreateTask(context.Background(), repository.CreateTaskInput{
		Name:      "Orphan",
		ParentUID: &missing,
		Start:     time.Now(),
		Finish:    time.Now(),
	})
	if err == nil {
		t.Fatal("expected error for unknown parent, got nil")
	}
}

func TestCreateTask_FinishBeforeStart(t *testing.T) {
	repo := NewRepository(testProject())

	_, err := repo.CreateTask(context.Background(), repository.CreateTaskInput{
		Name:   "Backwards",
		Start:  time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
		Finish: time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
	})
	if err == nil {
		t.Fatal("expected error for finish before start, got nil")
	}
}

func TestCreateTask_SameDayEarlierFinishTimeAllowed(t *testing.T) {
	repo := NewRepository(testProject())

	// Same calendar day, but finish's time-of-day (typical MSPDI import: 08:00
	// start) is earlier than start's (00:00, typical of a date-only edit) —
	// must still be accepted since the calendar dates aren't out of order.
	_, err := repo.CreateTask(context.Background(), repository.CreateTaskInput{
		Name:   "Same day",
		Start:  time.Date(2026, 7, 1, 8, 0, 0, 0, time.UTC),
		Finish: time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Errorf("CreateTask: unexpected error for a same-calendar-day range: %v", err)
	}
}

func TestUpdateTask_PartialFields(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()

	newName := "Renamed"
	newPercent := 50
	updated, err := repo.UpdateTask(ctx, 1, repository.UpdateTaskInput{
		Name:            &newName,
		PercentComplete: &newPercent,
	})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	if updated.Name != "Renamed" || updated.PercentComplete != 50 {
		t.Errorf("got name=%q percent=%d, want name=Renamed percent=50", updated.Name, updated.PercentComplete)
	}
	// Fields not passed in the input must survive unchanged.
	if updated.Start.IsZero() || updated.Finish.IsZero() {
		t.Error("Start/Finish were cleared by a partial update that didn't touch them")
	}
	// The effort estimate is derived from Start/Finish — an update that
	// doesn't touch either must not recompute (and so change) it.
	if updated.Duration != 0 {
		t.Errorf("Duration = %v, want unchanged (0, the fixture's original value) since Start/Finish weren't in this update", updated.Duration)
	}
}

func TestBusinessDaysDuration(t *testing.T) {
	date := func(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

	cases := []struct {
		name          string
		start, finish time.Time
		wantDays      int
	}{
		{"same weekday", date(2026, 6, 15), date(2026, 6, 15), 1},          // Monday
		{"same weekend day", date(2026, 6, 20), date(2026, 6, 20), 0},      // Saturday
		{"full mon-fri week", date(2026, 6, 15), date(2026, 6, 19), 5},     // Mon-Fri
		{"spans one weekend", date(2026, 6, 15), date(2026, 6, 21), 5},     // Mon-Sun
		{"reversed order", date(2026, 6, 21), date(2026, 6, 15), 5},        // finish before start
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := businessDaysDuration(tc.start, tc.finish)
			want := time.Duration(tc.wantDays) * workHoursPerDay * time.Hour
			if got != want {
				t.Errorf("businessDaysDuration(%s, %s) = %v, want %v (%d weekdays)",
					tc.start.Format("2006-01-02 Mon"), tc.finish.Format("2006-01-02 Mon"), got, want, tc.wantDays)
			}
		})
	}
}

func TestUpdateTask_RecomputesDurationExcludingWeekends(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()

	// 2026-06-03 is a Wednesday, 2026-06-12 is a Friday: 8 weekdays
	// (3,4,5, then 8,9,10,11,12 — the 6th/7th are a Sat/Sun and don't count).
	newStart := time.Date(2026, 6, 3, 8, 0, 0, 0, time.UTC)
	newFinish := time.Date(2026, 6, 12, 17, 0, 0, 0, time.UTC)
	updated, err := repo.UpdateTask(ctx, 1, repository.UpdateTaskInput{Start: &newStart, Finish: &newFinish})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	want := 8 * workHoursPerDay * time.Hour
	if updated.Duration != want {
		t.Errorf("Duration = %v, want %v (8 weekdays * %dh, weekends excluded)", updated.Duration, want, workHoursPerDay)
	}
}

func TestUpdateTask_ReplacesAssignments(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()

	newAssignees := []int{2}
	if _, err := repo.UpdateTask(ctx, 1, repository.UpdateTaskInput{AssigneeResourceUIDs: &newAssignees}); err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	project, _ := repo.GetProject(ctx)
	var forTask1 []entity.Assignment
	for _, a := range project.Assignments {
		if a.TaskUID == 1 {
			forTask1 = append(forTask1, a)
		}
	}
	if len(forTask1) != 1 || forTask1[0].ResourceUID != 2 {
		t.Errorf("assignments for task 1 = %+v, want exactly resource 2", forTask1)
	}
}

func TestUpdateTask_NotFound(t *testing.T) {
	repo := NewRepository(testProject())
	_, err := repo.UpdateTask(context.Background(), 999, repository.UpdateTaskInput{})
	if err == nil {
		t.Fatal("expected error for unknown task, got nil")
	}
}

func TestCreateTask_WithDependency(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()

	task, err := repo.CreateTask(ctx, repository.CreateTaskInput{
		Name:         "Successor",
		Start:        time.Now(),
		Finish:       time.Now(),
		Dependencies: []entity.Dependency{{PredecessorUID: 1, Type: entity.FinishToStart}},
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if len(task.Dependencies) != 1 || task.Dependencies[0].PredecessorUID != 1 {
		t.Errorf("Dependencies = %+v, want one dependency on predecessor 1", task.Dependencies)
	}
}

func TestCreateTask_SelfDependencyRejected(t *testing.T) {
	repo := NewRepository(testProject())

	// The task doesn't have a UID yet at validation time, so the check must
	// compare against the UID it is about to be assigned (nextTaskUID = 6).
	_, err := repo.CreateTask(context.Background(), repository.CreateTaskInput{
		Name:         "Self-referencing",
		Start:        time.Now(),
		Finish:       time.Now(),
		Dependencies: []entity.Dependency{{PredecessorUID: 6, Type: entity.FinishToStart}},
	})
	if err == nil {
		t.Fatal("expected error for self-referencing dependency, got nil")
	}
}

func TestCreateTask_DuplicateDependencyRejected(t *testing.T) {
	repo := NewRepository(testProject())

	_, err := repo.CreateTask(context.Background(), repository.CreateTaskInput{
		Name:   "Duplicate deps",
		Start:  time.Now(),
		Finish: time.Now(),
		Dependencies: []entity.Dependency{
			{PredecessorUID: 1, Type: entity.FinishToStart},
			{PredecessorUID: 1, Type: entity.StartToStart},
		},
	})
	if err == nil {
		t.Fatal("expected error for duplicate predecessor, got nil")
	}
}

func TestCreateTask_UnknownPredecessorRejected(t *testing.T) {
	repo := NewRepository(testProject())

	_, err := repo.CreateTask(context.Background(), repository.CreateTaskInput{
		Name:         "Orphan dependency",
		Start:        time.Now(),
		Finish:       time.Now(),
		Dependencies: []entity.Dependency{{PredecessorUID: 999, Type: entity.FinishToStart}},
	})
	if err == nil {
		t.Fatal("expected error for unknown predecessor, got nil")
	}
}

func TestCreateTask_InvalidDependencyTypeRejected(t *testing.T) {
	repo := NewRepository(testProject())

	_, err := repo.CreateTask(context.Background(), repository.CreateTaskInput{
		Name:         "Bad type",
		Start:        time.Now(),
		Finish:       time.Now(),
		Dependencies: []entity.Dependency{{PredecessorUID: 1, Type: entity.DependencyType(99)}},
	})
	if err == nil {
		t.Fatal("expected error for out-of-range dependency type, got nil")
	}
}

func TestUpdateTask_ReplacesDependencies(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()

	newDeps := []entity.Dependency{{PredecessorUID: 5, Type: entity.FinishToStart}}
	updated, err := repo.UpdateTask(ctx, 1, repository.UpdateTaskInput{Dependencies: &newDeps})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	if len(updated.Dependencies) != 1 || updated.Dependencies[0].PredecessorUID != 5 {
		t.Errorf("Dependencies = %+v, want one dependency on predecessor 5", updated.Dependencies)
	}
}

func TestUpdateTask_CycleRejected(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()

	// 1 depends on 5 ...
	depsOn5 := []entity.Dependency{{PredecessorUID: 5, Type: entity.FinishToStart}}
	if _, err := repo.UpdateTask(ctx, 1, repository.UpdateTaskInput{Dependencies: &depsOn5}); err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	// ... so making 5 depend on 1 would close a cycle and must be rejected.
	depsOn1 := []entity.Dependency{{PredecessorUID: 1, Type: entity.FinishToStart}}
	if _, err := repo.UpdateTask(ctx, 5, repository.UpdateTaskInput{Dependencies: &depsOn1}); err == nil {
		t.Fatal("expected error for direct cycle, got nil")
	}
}

func TestUpdateTask_TransitiveCycleRejected(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()

	// A (uid 6) -> depends on -> B (uid 1) -> depends on -> C (uid 5).
	a, err := repo.CreateTask(ctx, repository.CreateTaskInput{
		Name:         "A",
		Start:        time.Now(),
		Finish:       time.Now(),
		Dependencies: []entity.Dependency{{PredecessorUID: 1, Type: entity.FinishToStart}},
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	depsOn5 := []entity.Dependency{{PredecessorUID: 5, Type: entity.FinishToStart}}
	if _, err := repo.UpdateTask(ctx, 1, repository.UpdateTaskInput{Dependencies: &depsOn5}); err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	// Closing the loop: C (5) depends on A (a.UID) would make A transitively
	// depend on itself (A -> 1 -> 5 -> A).
	depsOnA := []entity.Dependency{{PredecessorUID: a.UID, Type: entity.FinishToStart}}
	if _, err := repo.UpdateTask(ctx, 5, repository.UpdateTaskInput{Dependencies: &depsOnA}); err == nil {
		t.Fatal("expected error for transitive cycle, got nil")
	}
}

func TestDeleteTask_CleansDanglingDependencies(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()

	deps := []entity.Dependency{{PredecessorUID: 1, Type: entity.FinishToStart}}
	if _, err := repo.UpdateTask(ctx, 5, repository.UpdateTaskInput{Dependencies: &deps}); err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	if err := repo.DeleteTask(ctx, 1); err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}

	project, _ := repo.GetProject(ctx)
	for _, task := range project.Tasks {
		if task.UID != 5 {
			continue
		}
		for _, d := range task.Dependencies {
			if d.PredecessorUID == 1 {
				t.Errorf("task 5 still depends on deleted task 1: %+v", task.Dependencies)
			}
		}
	}
}

func TestDeleteTask_Cascade(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()
	parentUID := 1

	child, err := repo.CreateTask(ctx, repository.CreateTaskInput{
		Name:      "Child",
		ParentUID: &parentUID,
		Start:     time.Now(),
		Finish:    time.Now(),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	if err := repo.DeleteTask(ctx, parentUID); err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}

	project, _ := repo.GetProject(ctx)
	for _, task := range project.Tasks {
		if task.UID == parentUID || task.UID == child.UID {
			t.Errorf("task %d still present after cascade delete", task.UID)
		}
	}
	for _, a := range project.Assignments {
		if a.TaskUID == parentUID {
			t.Errorf("assignment %+v for deleted task still present", a)
		}
	}
}

func TestDeleteTask_NotFound(t *testing.T) {
	repo := NewRepository(testProject())
	if err := repo.DeleteTask(context.Background(), 999); err == nil {
		t.Fatal("expected error for unknown task, got nil")
	}
}

func TestGetProject_ReturnsIndependentClone(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()

	first, _ := repo.GetProject(ctx)
	first.Tasks[0].Name = "Mutated by caller"

	second, _ := repo.GetProject(ctx)
	if second.Tasks[0].Name == "Mutated by caller" {
		t.Error("mutating a GetProject result affected a later GetProject call — not an independent clone")
	}
}

func TestConcurrentCreateTask(t *testing.T) {
	repo := NewRepository(testProject())
	ctx := context.Background()
	const n = 50

	var wg sync.WaitGroup
	uids := make(chan int, n)
	for range n {
		wg.Go(func() {
			task, err := repo.CreateTask(ctx, repository.CreateTaskInput{
				Name:   "Concurrent",
				Start:  time.Now(),
				Finish: time.Now().Add(24 * time.Hour),
			})
			if err != nil {
				t.Errorf("CreateTask: %v", err)
				return
			}
			uids <- task.UID
		})
	}
	wg.Wait()
	close(uids)

	seen := make(map[int]bool)
	for uid := range uids {
		if seen[uid] {
			t.Errorf("duplicate UID %d assigned under concurrent CreateTask", uid)
		}
		seen[uid] = true
	}
	if len(seen) != n {
		t.Errorf("got %d unique UIDs, want %d", len(seen), n)
	}
}
