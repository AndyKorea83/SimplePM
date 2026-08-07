package version

import (
	"os"
	"strings"
)

var Version = "0.0.0.0"

type Info struct {
	Version string
}

func NewVersionInfo(versionFile string) (*Info, error) {
	// Если файл существует (например, при локальном go run), читаем из него
	if data, err := os.ReadFile(versionFile); err == nil {
		cleanVersion := strings.TrimSpace(string(data))
		return &Info{Version: cleanVersion}, nil
	}

	// Если файла нет или мы собрали бинарник, берем зашитую переменную
	return &Info{Version: Version}, nil
}
