package mspdi

import (
	"context"
	"fmt"
	"os"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/repository"
)

// FileRepository implements repository.ProjectRepository by parsing an
// MSPDI XML file from disk on every call. It is the stage 1 stand-in for
// the stage 2 Gitea/MySQL-backed repository described in the roadmap.
type FileRepository struct {
	path string
}

// NewFileRepository returns a ProjectRepository that reads the MSPDI
// document at path.
func NewFileRepository(path string) *FileRepository {
	return &FileRepository{path: path}
}

var _ repository.ProjectRepository = (*FileRepository)(nil)

func (r *FileRepository) GetProject(_ context.Context) (*entity.Project, error) {
	f, err := os.Open(r.path)
	if err != nil {
		return nil, fmt.Errorf("mspdi: open %s: %w", r.path, err)
	}
	defer f.Close()

	project, err := Parse(f)
	if err != nil {
		return nil, fmt.Errorf("mspdi: parse %s: %w", r.path, err)
	}
	return project, nil
}
