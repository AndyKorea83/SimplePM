package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

// NewRouter строит chi-роутер приложения.
func NewRouter(projectService usecase.ProjectService, timesheetService usecase.TimesheetService, qaService usecase.QAService) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		// Dev-фронтенд работает на своём порту Vite; разрешаем его на Этапе 1.
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
	qaHandler := NewQAHandler(qaService)
	r.Route("/api", func(r chi.Router) {
		r.Route("/projects", func(r chi.Router) {
			r.Get("/", projectHandler.ListProjects)
			r.Post("/", projectHandler.CreateProject)
			r.Post("/import", projectHandler.ImportProject)
			r.Route("/{projectId}", func(r chi.Router) {
				r.Get("/", projectHandler.GetProject)
				r.Patch("/", projectHandler.UpdateProject)
				r.Get("/export", projectHandler.ExportProject)
				r.Route("/tasks", func(r chi.Router) {
					r.Post("/", taskHandler.CreateTask)
					r.Patch("/{uid}", taskHandler.UpdateTask)
					r.Delete("/{uid}", taskHandler.DeleteTask)
				})
			})
		})
		r.Get("/timesheet", timesheetHandler.GetMonth)
		r.Get("/timesheet/export", timesheetHandler.ExportLaborCosts)
		r.Route("/qa", func(r chi.Router) {
			r.Get("/kanban", qaHandler.ListKanban)
			r.Get("/bug-report", qaHandler.ListBugReport)
			r.Get("/metrics", qaHandler.GetMetrics)
			r.Route("/bugs/{uid}", func(r chi.Router) {
				r.Patch("/", qaHandler.UpdateBugStatus)
				r.Get("/history", qaHandler.GetBugHistory)
			})
		})
	})

	return r
}
