package mspdi

import (
	"context"
	"fmt"
	"os"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// FileRepository parses an MSPDI XML file from disk on every call. It is
// used directly (not through repository.ProjectRepository, which now models
// a full multi-project store) just once at startup, to seed memstore's
// initial project — see cmd/server/main.go.
type FileRepository struct {
	path string
}

// NewFileRepository returns a FileRepository that reads the MSPDI document
// at path.
func NewFileRepository(path string) *FileRepository {
	return &FileRepository{path: path}
}

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
