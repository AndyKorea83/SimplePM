package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

// NewRouter builds the application's chi router.
func NewRouter(projectService usecase.ProjectService) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		// Dev frontend runs on its own Vite port; allow it during stage 1.
		AllowedOrigins: []string{"http://localhost:*"},
		AllowedMethods: []string{http.MethodGet, http.MethodOptions},
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	projectHandler := NewProjectHandler(projectService)
	r.Route("/api", func(r chi.Router) {
		r.Get("/project", projectHandler.GetProject)
	})

	return r
}
