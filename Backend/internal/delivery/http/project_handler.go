package http

import (
	"encoding/json"
	"log"
	"net/http"

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

// GetProject handles GET /api/project.
func (h *ProjectHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	project, err := h.service.GetProject(r.Context())
	if err != nil {
		log.Printf("get project: %v", err)
		http.Error(w, "failed to load project", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newProjectDTO(project)); err != nil {
		log.Printf("encode project response: %v", err)
	}
}
