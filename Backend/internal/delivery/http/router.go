package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

// NewRouter builds the application's chi router.
func NewRouter(projectService usecase.ProjectService, timesheetService usecase.TimesheetService) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		// Dev frontend runs on its own Vite port; allow it during stage 1.
		AllowedOrigins: []string{"http://localhost:*"},
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowedHeaders: []string{"Content-Type"},
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	projectHandler := NewProjectHandler(projectService)
	taskHandler := NewTaskHandler(projectService)
	timesheetHandler := NewTimesheetHandler(timesheetService)
	r.Route("/api", func(r chi.Router) {
		r.Get("/project", projectHandler.GetProject)
		r.Route("/tasks", func(r chi.Router) {
			r.Post("/", taskHandler.CreateTask)
			r.Patch("/{uid}", taskHandler.UpdateTask)
			r.Delete("/{uid}", taskHandler.DeleteTask)
		})
		r.Get("/timesheet", timesheetHandler.GetMonth)
	})

	return r
}
