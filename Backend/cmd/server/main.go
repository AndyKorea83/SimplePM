// Command server runs the GranchPM backend API.
package main

import (
	"log"
	"net/http"
	"os"

	deliveryhttp "github.com/AndyKorea83/SimplePM/src/Backend/internal/delivery/http"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository/mspdi"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

func main() {
	addr := envOrDefault("ADDR", ":8080")
	// samples/ lives outside the git repo (see CODE.md) and holds the
	// stage 1 Gantt data source; override with PROJECT_XML_PATH if the
	// server isn't run from src/Backend.
	xmlPath := envOrDefault("PROJECT_XML_PATH", "../../samples/project.xml")

	repo := mspdi.NewFileRepository(xmlPath)
	service := usecase.NewProjectService(repo)
	router := deliveryhttp.NewRouter(service)

	log.Printf("listening on %s (project data: %s)", addr, xmlPath)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatal(err)
	}
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
