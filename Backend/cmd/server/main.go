// Command server runs the GranchPM backend API.
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	deliveryhttp "github.com/AndyKorea83/SimplePM/src/Backend/internal/delivery/http"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository/memstore"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository/mspdi"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

func main() {
	addr := envOrDefault("ADDR", ":8080")
	// samples/ lives outside the git repo (see CODE.md) and holds the
	// stage 1 Gantt data source; override with PROJECT_XML_PATH if the
	// server isn't run from src/Backend.
	xmlPath := envOrDefault("PROJECT_XML_PATH", "../../samples/project.xml")

	// The XML file is only read once, at startup: task create/update/delete
	// mutate the in-memory store from there on, per the roadmap's stage
	// 1/PoC scope (no real persistence until stage 2's Gitea/MySQL backend).
	initial, err := mspdi.NewFileRepository(xmlPath).GetProject(context.Background())
	if err != nil {
		log.Fatalf("load initial project: %v", err)
	}
	store := memstore.NewRepository(initial)
	service := usecase.NewProjectService(store)
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
