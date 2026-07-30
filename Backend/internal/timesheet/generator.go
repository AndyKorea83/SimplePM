// Package timesheet builds the synthetic dataset behind the "Календарь" page.
// It is deliberately independent of the Gantt entity.Project model — this
// stage-1 PoC has no real "hours logged per day" data source, so it invents
// its own employees/themes/tasks instead of reusing entity.Task/Resource.
package timesheet

import (
	"math/rand"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// RangeStart/RangeEnd bound the generated dataset — 12 calendar months,
// matching the calendar page's month picker.
var (
	RangeStart = time.Date(2025, time.August, 1, 0, 0, 0, 0, time.UTC)
	RangeEnd   = time.Date(2026, time.July, 31, 0, 0, 0, 0, time.UTC)
)

type Dataset struct {
	Employees []entity.TimesheetEmployee
	Themes    []entity.TimesheetTheme
	Tasks     []entity.TimesheetTask
	Entries   []entity.TimesheetEntry
}

// Data satisfies usecase's timesheetDataset interface.
func (d *Dataset) Data() ([]entity.TimesheetEmployee, []entity.TimesheetTheme, []entity.TimesheetTask, []entity.TimesheetEntry) {
	return d.Employees, d.Themes, d.Tasks, d.Entries
}

type employeeSeed struct {
	name string
	team string
}

// Ростер и разбиение по командам — из макета Figma "Employee Dropdown"
// (164:2864/168:1925, 3-колоночная версия), issue #45. Порядок сохраняет
// раскладку по колонкам из макета.
var employeeSeeds = []employeeSeed{
	{"Софья Селезнева", "Тестирование"},
	{"Антон Данилов", "Тестирование"},
	{"Вадим Ужакин", "Тестирование"},
	{"Екатерина Дроздова", "Тестирование"},
	{"Захар Даурцев", "Embedded-разработка"},
	{"Андрей Хакимов", "Embedded-разработка"},
	{"Кирилл Кузнецов", "Embedded-разработка"},
	{"Илья Ребус", "Embedded-разработка"},
	{"Александр Стребков", "Backend"},
	{"Алёна Мелехова", "Backend"},
	{"Евгений Власов", "Backend"},
	{"Иван Межевой", "Backend"},
	{"Павел Орехов", "Frontend"},
	{"Данила Головицкий", "Frontend"},
	{"Дмитрий Каштанов", "Мобильная разработка"},
	{"Татьяна Иванова", "Мобильная разработка"},
	{"Ирина Васильева", "Системный аналитик"},
}

var themeNamePool = []string{
	"Бабочка-М [закрыта]",
	"Бабочка-Н [закрыта]",
	"Аврора [в работе]",
	"Комета [в работе]",
	"Горизонт [закрыта]",
	"Меридиан [в работе]",
	"Каскад [закрыта]",
	"Прибой [в работе]",
}

var taskNamePool = []string{
	"#136 [TestRequest] БС-06 Модуль интеграции",
	"#142 [Bug] БС-12 Ошибка валидации токена",
	"#155 [Feature] БС-02 Панель администрирования",
	"#161 [Task] Рефакторинг моделей данных БД",
	"#170 [Bug] БС-15 Утечка памяти в воркере",
	"#183 [Feature] БС-09 Экспорт отчётов в CSV",
	"#191 [Task] Обновление зависимостей",
	"#204 [TestRequest] БС-20 Нагрузочное тестирование",
}

// Generate builds the dataset deterministically (fixed seed): same result
// every server start, so the demo data doesn't shuffle on restart.
func Generate() *Dataset {
	rng := rand.New(rand.NewSource(42))
	ds := &Dataset{}
	nextThemeUID, nextTaskUID := 1, 1

	for i, seed := range employeeSeeds {
		employeeUID := i + 1
		ds.Employees = append(ds.Employees, entity.TimesheetEmployee{UID: employeeUID, Name: seed.name, Team: seed.team})

		const themesPerEmployee = 2
		employeeThemes := make([]entity.TimesheetTheme, 0, themesPerEmployee)
		tasksByTheme := make(map[int][2]int)

		for t := range themesPerEmployee {
			themeUID := nextThemeUID
			nextThemeUID++
			theme := entity.TimesheetTheme{
				UID:         themeUID,
				EmployeeUID: employeeUID,
				Name:        themeNamePool[(i*themesPerEmployee+t)%len(themeNamePool)],
			}
			ds.Themes = append(ds.Themes, theme)
			employeeThemes = append(employeeThemes, theme)

			var taskUIDs [2]int
			for k := range 2 {
				taskUID := nextTaskUID
				nextTaskUID++
				ds.Tasks = append(ds.Tasks, entity.TimesheetTask{
					UID:      taskUID,
					ThemeUID: themeUID,
					Name:     taskNamePool[(i*4+t*2+k)%len(taskNamePool)],
				})
				taskUIDs[k] = taskUID
			}
			tasksByTheme[themeUID] = taskUIDs
		}

		// Each theme is "active" for a contiguous chunk of the year, then
		// hands off to the next — mimics one epic wrapping up and another
		// starting, rather than every task having hours every day.
		totalDays := daysBetween(RangeStart, RangeEnd) + 1
		switchDay := totalDays * 2 / 3

		for day := range totalDays {
			date := RangeStart.AddDate(0, 0, day)
			if date.Weekday() == time.Saturday || date.Weekday() == time.Sunday {
				continue
			}

			activeTheme := employeeThemes[0]
			if day >= switchDay && len(employeeThemes) > 1 {
				activeTheme = employeeThemes[1]
			}

			dayTotal := pickDayTotal(rng)
			if dayTotal == 0 {
				continue
			}

			taskUIDs := tasksByTheme[activeTheme.UID]
			first, second := splitHours(rng, dayTotal)
			for _, split := range [2]struct {
				taskUID int
				hours   int
			}{{taskUIDs[0], first}, {taskUIDs[1], second}} {
				if split.hours <= 0 {
					continue
				}
				ds.Entries = append(ds.Entries, entity.TimesheetEntry{
					TaskUID: split.taskUID,
					Date:    date,
					Hours:   split.hours,
				})
			}
		}
	}

	return ds
}

// pickDayTotal returns a normal full day (8h) most of the time, with
// occasional days off (0) or an over/under-time anomaly.
func pickDayTotal(rng *rand.Rand) int {
	switch roll := rng.Intn(100); {
	case roll < 75:
		return 8
	case roll < 85:
		return 0
	default:
		anomalies := []int{3, 5, 6, 10}
		return anomalies[rng.Intn(len(anomalies))]
	}
}

// splitHours divides a day's total between the theme's two tasks.
func splitHours(rng *rand.Rand, total int) (int, int) {
	if total <= 1 {
		return total, 0
	}
	first := 1 + rng.Intn(total-1)
	return first, total - first
}

func daysBetween(from, to time.Time) int {
	return int(to.Sub(from).Hours() / 24)
}
