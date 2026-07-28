package mspdi

import (
	"encoding/xml"
	"fmt"
	"io"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// Parse reads an MSPDI (Microsoft Project XML) document and converts it
// into the application's domain model.
func Parse(r io.Reader) (*entity.Project, error) {
	var doc xmlProject
	if err := xml.NewDecoder(r).Decode(&doc); err != nil {
		return nil, fmt.Errorf("mspdi: decode xml: %w", err)
	}
	return toProject(&doc)
}
