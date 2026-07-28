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
