package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

const versionFile = "version.txt"

func main() {
	// 1. Парсим аргументы командной строки
	buildType := flag.String("type", "dev", "Тип сборки: dev, fix, ready")
	flag.Parse()

	// 2. Читаем текущую версию или создаем дефолтную
	currentVersion := "0.0.0.0"
	if data, err := os.ReadFile(versionFile); err == nil {
		currentVersion = strings.TrimSpace(string(data))
	}

	// Разделяем строку версии на составные части
	parts := strings.Split(currentVersion, ".")
	if len(parts) != 4 {
		parts = []string{"0", "0", "0", "0"}
	}

	// Переводим строки в числа для инкремента
	x, _ := strconv.Atoi(parts[0])
	y, _ := strconv.Atoi(parts[1])
	z, _ := strconv.Atoi(parts[2])
	b, _ := strconv.Atoi(parts[3])

	// Правило 0 & 1: Счётчик билдов 'b' растет ВСЕГДА
	b++

	// Переменные для флагов оптимизации компилятора
	ldFlags := ""

	// Обрабатываем типы сборки
	switch *buildType {
	case "fix":
		// Правило 2: Инкрементируем z, сбрасываем b
		z++
		// Дополнительно: Оптимизация (вырезаем отладочную информацию)
		ldFlags = "-s -w"
		fmt.Println("🚀 Сборка FIX: Включены оптимизации")

	case "ready":
		// Правило 3: Инкрементируем y, сбрасываем z и b
		y++
		z = 0
		// Дополнительно: Оптимизация
		ldFlags = "-s -w"
		fmt.Println("👑 Сборка READY: Включены оптимизации")

	default:
		fmt.Println("🛠️ Сборка DEV (Локальная)")
	}

	// Формируем новую строку версии
	newVersion := fmt.Sprintf("%d.%d.%d.%d", x, y, z, b)

	// Записываем обновленную версию обратно в текстовый файл
	if err := os.WriteFile(versionFile, []byte(newVersion), 0644); err != nil {
		log.Fatalf("Не удалось обновить файл версии: %v", err)
	}
	fmt.Printf("Обновлена версия в %s: %s\n", versionFile, newVersion)

	// Добавляем прошивку переменной в ldflags
	versionTarget := "deploy-test/internal/version.Version"
	if ldFlags != "" {
		ldFlags = fmt.Sprintf("%s -X '%s=%s'", ldFlags, versionTarget, newVersion)
	} else {
		ldFlags = fmt.Sprintf("-X '%s=%s'", versionTarget, newVersion)
	}

	// 3. Вызываем системную сборку Go
	// Имя выходного файла можете поменять на свое
	cmd := exec.Command("go", "build", "-ldflags", ldFlags, "-o", "server.exe", "./cmd/server/main.go")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	fmt.Println("Запуск go build...")
	if err := cmd.Run(); err != nil {
		log.Fatalf("Ошибка компиляции проекта: %v", err)
	}

	fmt.Println("✅ Сборка успешно завершена!")
}
