package http

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

// TaskHandler отдаёт мутации задач по HTTP.
type TaskHandler struct {
	service usecase.ProjectService
}

// NewTaskHandler строит TaskHandler поверх service.
func NewTaskHandler(service usecase.ProjectService) *TaskHandler {
	return &TaskHandler{service: service}
}

type createTaskRequest struct {
	Name                 string          `json:"name"`
	ParentUID            *int            `json:"parentUid,omitempty"`
	Start                string          `json:"start"`
	Finish               string          `json:"finish"`
	PercentComplete      int             `json:"percentComplete"`
	IsMilestone          bool            `json:"isMilestone"`
	IsBlocked            bool            `json:"isBlocked"`
	AssigneeResourceUIDs []int           `json:"assigneeResourceUids"`
	Dependencies         []dependencyDTO `json:"dependencies,omitempty"`
}

// CreateTask обрабатывает POST /api/projects/{projectId}/tasks.
func (h *TaskHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
	projectID, err := projectIDParam(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var req createTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	start, err := time.Parse(time.RFC3339, req.Start)
	if err != nil {
		http.Error(w, "invalid start date", http.StatusBadRequest)
		return
	}
	finish, err := time.Parse(time.RFC3339, req.Finish)
	if err != nil {
		http.Error(w, "invalid finish date", http.StatusBadRequest)
		return
	}

	task, err := h.service.CreateTask(r.Context(), projectID, repository.CreateTaskInput{
		Name:                 req.Name,
		ParentUID:            req.ParentUID,
		Start:                start,
		Finish:               finish,
		PercentComplete:      req.PercentComplete,
		IsMilestone:          req.IsMilestone,
		IsBlocked:            req.IsBlocked,
		AssigneeResourceUIDs: req.AssigneeResourceUIDs,
		Dependencies:         toDependencies(req.Dependencies),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(newTaskDTO(task)); err != nil {
		log.Printf("encode created task response: %v", err)
	}
}

type updateTaskRequest struct {
	Name                 *string          `json:"name,omitempty"`
	Start                *string          `json:"start,omitempty"`
	Finish               *string          `json:"finish,omitempty"`
	PercentComplete      *int             `json:"percentComplete,omitempty"`
	IsBlocked            *bool            `json:"isBlocked,omitempty"`
	AssigneeResourceUIDs *[]int           `json:"assigneeResourceUids,omitempty"`
	Dependencies         *[]dependencyDTO `json:"dependencies,omitempty"`
}

// UpdateTask обрабатывает PATCH /api/projects/{projectId}/tasks/{uid}.
func (h *TaskHandler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	projectID, err := projectIDParam(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	uid, err := strconv.Atoi(chi.URLParam(r, "uid"))
	if err != nil {
		http.Error(w, "invalid task uid", http.StatusBadRequest)
		return
	}

	var req updateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	input := repository.UpdateTaskInput{
		Name:                 req.Name,
		PercentComplete:      req.PercentComplete,
		IsBlocked:            req.IsBlocked,
		AssigneeResourceUIDs: req.AssigneeResourceUIDs,
	}
	if req.Start != nil {
		start, err := time.Parse(time.RFC3339, *req.Start)
		if err != nil {
			http.Error(w, "invalid start date", http.StatusBadRequest)
			return
		}
		input.Start = &start
	}
	if req.Finish != nil {
		finish, err := time.Parse(time.RFC3339, *req.Finish)
		if err != nil {
			http.Error(w, "invalid finish date", http.StatusBadRequest)
			return
		}
		input.Finish = &finish
	}
	if req.Dependencies != nil {
		converted := toDependencies(*req.Dependencies)
		input.Dependencies = &converted
	}

	task, err := h.service.UpdateTask(r.Context(), projectID, uid, input)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newTaskDTO(task)); err != nil {
		log.Printf("encode updated task response: %v", err)
	}
}

// DeleteTask обрабатывает DELETE /api/projects/{projectId}/tasks/{uid}.
func (h *TaskHandler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	projectID, err := projectIDParam(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	uid, err := strconv.Atoi(chi.URLParam(r, "uid"))
	if err != nil {
		http.Error(w, "invalid task uid", http.StatusBadRequest)
		return
	}

	if err := h.service.DeleteTask(r.Context(), projectID, uid); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
