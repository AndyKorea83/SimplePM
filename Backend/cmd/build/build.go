package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

const versionFile = "version.txt"
const versionTarget = "deploy-test/internal/version.Version"

// ANSI цвета для терминала
const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
)

// Config хранит разобранные параметры командной строки
type Config struct {
	BuildType   string
	BuildTarget string
	OutDir      string
}

// Version представляет разобранную версию x.y.z.b
type Version struct {
	X, Y, Z, B int
}

func main() {
	setupUsage()
	cfg := parseFlags()

	v := readCurrentVersion()
	v = updateVersionNumbers(v, cfg.BuildType)
	saveVersion(v)

	ldFlags := generateLDFlags(v, cfg.BuildType)
	binaryName, envs := configureTarget(cfg.BuildTarget)

	buildBinary(cfg.OutDir, binaryName, ldFlags, envs)
}

// printSuccess выводит текст зеленым цветом
func printSuccess(format string, a ...interface{}) {
	fmt.Printf(colorGreen+format+colorReset+"\n", a...)
}

// printError выводит текст красным цветом
func printError(format string, a ...interface{}) {
	fmt.Fprintf(os.Stderr, colorRed+format+colorReset+"\n", a...)
}

// setupUsage настраивает кастомный вывод справки с цветовым выделением
// setupUsage настраивает кастомный вывод справки с цветовым выделением
func setupUsage() {
	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "Скрипт автоматизации сборки проекта deploy-test\n\n")
		fmt.Fprintf(flag.CommandLine.Output(), "Использование:\n")
		fmt.Fprintf(flag.CommandLine.Output(), "  go run build.go [%sпараметры%s]\n\n", colorYellow, colorReset)

		fmt.Fprintf(flag.CommandLine.Output(), "Доступные параметры:\n")
		// Ручной вывод параметров с цветовым выделением флагов и их значений
		fmt.Fprintf(flag.CommandLine.Output(), "  %s-type%s %sstring%s\n\tТип сборки: dev, fix, ready (по умолчанию \"dev\")\n", colorYellow, colorReset, colorGreen, colorReset)
		fmt.Fprintf(flag.CommandLine.Output(), "  %s-target%s %sstring%s\n\tЦель сборки: host, container (по умолчанию \"host\")\n", colorYellow, colorReset, colorGreen, colorReset)
		fmt.Fprintf(flag.CommandLine.Output(), "  %s-out-dir%s %sstring%s\n\tДиректория для сохранения готового бинарника (по умолчанию \"./build/\")\n", colorYellow, colorReset, colorGreen, colorReset)

		fmt.Fprintf(flag.CommandLine.Output(), "\nПравила изменения версии (x.y.z.b):\n")
		fmt.Fprintf(flag.CommandLine.Output(), "  - Счётчик '%sb%s' (билд) увеличивается при ЛЮБОМ запуске скрипта и никогда не сбрасывается.\n", colorYellow, colorReset)
		fmt.Fprintf(flag.CommandLine.Output(), "  - При %s-type=fix%s увеличивается '%sz%s' (патч).\n", colorYellow, colorReset, colorYellow, colorReset)
		fmt.Fprintf(flag.CommandLine.Output(), "  - При %s-type=ready%s увеличивается '%sy%s' (минорная версия), а 'z' сбрасывается в 0.\n", colorYellow, colorReset, colorYellow, colorReset)
		fmt.Fprintf(flag.CommandLine.Output(), "  - Для fix и ready автоматически включаются оптимизации компилятора (-s -w).\n\n")

		fmt.Fprintf(flag.CommandLine.Output(), "Примеры команд:\n")
		fmt.Fprintf(flag.CommandLine.Output(), "  %sgo run build.go -type dev%s                            # Локальная dev-сборка в папку ./build/\n", colorYellow, colorReset)
		fmt.Fprintf(flag.CommandLine.Output(), "  %sgo run build.go -type fix -target container%s          # Сборка фикса под Docker\n", colorYellow, colorReset)
		fmt.Fprintf(flag.CommandLine.Output(), "  %sgo run build.go -type ready -out-dir ./dist/%s         # Релизная сборка для хоста в папку ./dist/\n", colorYellow, colorReset)
	}
}

// parseFlags обрабатывает аргументы и валидирует их
func parseFlags() Config {
	buildType := flag.String("type", "dev", "Тип сборки: dev, fix, ready")
	buildTarget := flag.String("target", "host", "Цель сборки: host, container")
	outDir := flag.String("out-dir", "./build/", "Директория для сохранения готового бинарника")
	flag.Parse()

	if flag.NFlag() == 0 {
		flag.Usage()
		os.Exit(0)
	}

	if *buildTarget != "host" && *buildTarget != "container" {
		printError("Ошибка: Неверное значение target: %s", *buildTarget)
		flag.Usage()
		os.Exit(1)
	}

	if *buildType != "dev" && *buildType != "fix" && *buildType != "ready" {
		printError("Ошибка: Неизвестный тип сборки: %s", *buildType)
		flag.Usage()
		os.Exit(1)
	}

	return Config{
		BuildType:   *buildType,
		BuildTarget: *buildTarget,
		OutDir:      *outDir,
	}
}

// readCurrentVersion читает текущую версию из текстового файла
func readCurrentVersion() Version {
	currentVersion := "0.0.0.0"
	if data, err := os.ReadFile(versionFile); err == nil {
		currentVersion = strings.TrimSpace(string(data))
	}

	parts := strings.Split(currentVersion, ".")
	if len(parts) != 4 {
		parts = []string{"0", "0", "0", "0"}
	}

	x, _ := strconv.Atoi(parts[0])
	y, _ := strconv.Atoi(parts[1])
	z, _ := strconv.Atoi(parts[2])
	b, _ := strconv.Atoi(parts[3])

	return Version{X: x, Y: y, Z: z, B: b}
}

// updateVersionNumbers применяет правила инкремента разрядов
func updateVersionNumbers(v Version, buildType string) Version {
	v.B++ // Счетчик 'b' растет всегда

	switch buildType {
	case "fix":
		v.Z++
		fmt.Println("Сборка FIX: Включены оптимизации")
	case "ready":
		v.Y++
		v.Z = 0
		fmt.Println("Сборка READY: Включены оптимизации")
	case "dev":
		fmt.Println("Сборка DEV (Локальная)")
	}

	return v
}

// saveVersion сохраняет новую строчку версии в файл
func saveVersion(v Version) {
	newVersionStr := fmt.Sprintf("%d.%d.%d.%d", v.X, v.Y, v.Z, v.B)
	if err := os.WriteFile(versionFile, []byte(newVersionStr), 0644); err != nil {
		printError("Не удалось обновить файл версии: %v", err)
		os.Exit(1)
	}
	printSuccess("Обновлена версия в %s: %s", versionFile, newVersionStr)
}

// generateLDFlags формирует аргументы -ldflags для компилятора
func generateLDFlags(v Version, buildType string) string {
	newVersionStr := fmt.Sprintf("%d.%d.%d.%d", v.X, v.Y, v.Z, v.B)
	ldFlags := ""

	if buildType == "fix" || buildType == "ready" {
		ldFlags = "-s -w"
	}

	if ldFlags != "" {
		return fmt.Sprintf("%s -X '%s=%s'", ldFlags, versionTarget, newVersionStr)
	}
	return fmt.Sprintf("-X '%s=%s'", versionTarget, newVersionStr)
}

// configureTarget настраивает имя файла и переменные окружения ОС
func configureTarget(target string) (string, []string) {
	binaryName := "server"
	envs := append([]string{}, os.Environ()...)

	if target == "container" {
		fmt.Println("Целевая платформа: CONTAINER (Linux, статический бинарник)")
		binaryName = "server_linux"
		envs = append(envs, "GOOS=linux", "GOARCH=amd64", "CGO_ENABLED=0")
	} else {
		fmt.Println("Целевая платформа: HOST (Текущая ОС)")
		if runtime.GOOS == "windows" {
			binaryName = "server.exe"
		}
	}

	return binaryName, envs
}

// buildBinary выполняет системный вызов go build
func buildBinary(outDir, binaryName, ldFlags string, envs []string) {
	if err := os.MkdirAll(outDir, 0755); err != nil {
		printError("Не удалось создать директорию для сборки: %v", err)
		os.Exit(1)
	}

	outputPath := filepath.Join(outDir, binaryName)
	cmd := exec.Command("go", "build", "-ldflags", ldFlags, "-o", outputPath, "./cmd/server/main.go")
	cmd.Env = envs
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	fmt.Println("Запуск go build...")
	if err := cmd.Run(); err != nil {
		printError("Ошибка компиляции проекта: %v", err)
		os.Exit(1)
	}

	printSuccess("Сборка успешно завершена! Создан файл: %s", outputPath)
}
