package http

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository/mspdi"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

// ProjectHandler exposes project/Gantt data over HTTP.
type ProjectHandler struct {
	service usecase.ProjectService
}

// NewProjectHandler builds a ProjectHandler backed by service.
func NewProjectHandler(service usecase.ProjectService) *ProjectHandler {
	return &ProjectHandler{service: service}
}

func projectIDParam(r *http.Request) (int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "projectId"))
	if err != nil {
		return 0, fmt.Errorf("invalid project id")
	}
	return id, nil
}

// GetProject handles GET /api/projects/{projectId}.
func (h *ProjectHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := projectIDParam(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	project, err := h.service.GetProject(r.Context(), projectID)
	if err != nil {
		log.Printf("get project: %v", err)
		http.Error(w, "failed to load project", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newProjectDTO(project)); err != nil {
		log.Printf("encode project response: %v", err)
	}
}

// ListProjects handles GET /api/projects — the "Проекты" list page.
func (h *ProjectHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	summaries, err := h.service.ListProjectSummaries(r.Context())
	if err != nil {
		log.Printf("list projects: %v", err)
		http.Error(w, "failed to load projects", http.StatusInternalServerError)
		return
	}

	dtos := make([]projectSummaryDTO, 0, len(summaries))
	for _, s := range summaries {
		dtos = append(dtos, newProjectSummaryDTO(s))
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(dtos); err != nil {
		log.Printf("encode project list response: %v", err)
	}
}

type createProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// CreateProject handles POST /api/projects — creates an empty project (no
// tasks yet), which the "Новый проект" button opens a modal for.
func (h *ProjectHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	project, err := h.service.CreateProject(r.Context(), repository.CreateProjectInput{
		Name:        req.Name,
		Description: req.Description,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(newProjectDTO(&project)); err != nil {
		log.Printf("encode created project response: %v", err)
	}
}

type updateProjectRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// UpdateProject handles PATCH /api/projects/{projectId} — the "Проекты"
// list's edit modal only touches metadata; dates/task counts are derived.
func (h *ProjectHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := projectIDParam(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var req updateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	project, err := h.service.UpdateProject(r.Context(), projectID, repository.UpdateProjectInput{
		Name:        req.Name,
		Description: req.Description,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newProjectDTO(&project)); err != nil {
		log.Printf("encode updated project response: %v", err)
	}
}

// ImportProject handles POST /api/projects/import — multipart form with
// name, description and an MSPDI XML file, per the "Импортировать" modal.
func (h *ProjectHandler) ImportProject(w http.ResponseWriter, r *http.Request) {
	// 32MB is chi/net-http's usual default for ParseMultipartForm; project
	// XML files are small text documents, nowhere near that size in practice.
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "invalid multipart form", http.StatusBadRequest)
		return
	}

	name := r.FormValue("name")
	if name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	description := r.FormValue("description")

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	project, err := h.service.ImportProject(r.Context(), name, description, file)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(newProjectDTO(&project)); err != nil {
		log.Printf("encode imported project response: %v", err)
	}
}

// ExportProject handles GET /api/projects/{projectId}/export — downloads
// the project as an MSPDI XML file (samples/project.xml's format).
func (h *ProjectHandler) ExportProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := projectIDParam(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	project, err := h.service.ExportProject(r.Context(), projectID)
	if err != nil {
		log.Printf("export project: %v", err)
		http.Error(w, "failed to load project", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/xml")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.xml"`, project.Name))
	if err := mspdi.Write(w, project); err != nil {
		log.Printf("write project export: %v", err)
	}
}
