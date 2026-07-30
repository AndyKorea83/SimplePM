package usecase

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// TimesheetMonth is one calendar month's worth of logged hours, already
// shaped per employee/theme/task for the "Календарь" page — the delivery
// layer only needs to JSON-encode it, no further aggregation.
type TimesheetMonth struct {
	Year        int
	Month       int
	DaysInMonth int
	Employees   []TimesheetEmployeeMonth
}

type TimesheetEmployeeMonth struct {
	UID         int
	Name        string
	Team        string
	DailyTotals []int
	TotalHours  int
	Themes      []TimesheetThemeMonth
}

type TimesheetThemeMonth struct {
	UID         int
	Name        string
	DailyTotals []int
	Tasks       []TimesheetTaskMonth
}

type TimesheetTaskMonth struct {
	UID        int
	Name       string
	DailyHours []int
}

// TimesheetService exposes the calendar page's per-month time-tracking view.
type TimesheetService interface {
	GetMonth(ctx context.Context, year int, month time.Month) (*TimesheetMonth, error)
}

// timesheetDataset is the minimal contract TimesheetService needs from the
// generated dataset — defined here, at the point of use.
type timesheetDataset interface {
	Data() (employees []entity.TimesheetEmployee, themes []entity.TimesheetTheme, tasks []entity.TimesheetTask, entries []entity.TimesheetEntry)
}

type timesheetService struct {
	dataset              timesheetDataset
	rangeStart, rangeEnd time.Time
}

// NewTimesheetService builds a TimesheetService over dataset; rangeStart/
// rangeEnd bound which months GetMonth will serve (matching the dataset's
// own generated span).
func NewTimesheetService(dataset timesheetDataset, rangeStart, rangeEnd time.Time) TimesheetService {
	return &timesheetService{dataset: dataset, rangeStart: rangeStart, rangeEnd: rangeEnd}
}

func (s *timesheetService) GetMonth(_ context.Context, year int, month time.Month) (*TimesheetMonth, error) {
	monthStart := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	if monthStart.Before(firstOfMonth(s.rangeStart)) || monthStart.After(firstOfMonth(s.rangeEnd)) {
		return nil, fmt.Errorf("month %04d-%02d is outside the available data range", year, month)
	}
	daysInMonth := monthStart.AddDate(0, 1, -1).Day()

	employees, themes, tasks, entries := s.dataset.Data()

	hoursByTaskDay := make(map[int]map[int]int, len(tasks))
	for _, e := range entries {
		if e.Date.Year() != year || e.Date.Month() != month {
			continue
		}
		if hoursByTaskDay[e.TaskUID] == nil {
			hoursByTaskDay[e.TaskUID] = make(map[int]int)
		}
		hoursByTaskDay[e.TaskUID][e.Date.Day()] += e.Hours
	}

	tasksByTheme := make(map[int][]entity.TimesheetTask)
	for _, t := range tasks {
		tasksByTheme[t.ThemeUID] = append(tasksByTheme[t.ThemeUID], t)
	}
	themesByEmployee := make(map[int][]entity.TimesheetTheme)
	for _, th := range themes {
		themesByEmployee[th.EmployeeUID] = append(themesByEmployee[th.EmployeeUID], th)
	}

	result := &TimesheetMonth{Year: year, Month: int(month), DaysInMonth: daysInMonth}

	for _, emp := range employees {
		empMonth := TimesheetEmployeeMonth{
			UID:         emp.UID,
			Name:        emp.Name,
			Team:        emp.Team,
			DailyTotals: make([]int, daysInMonth),
		}

		for _, th := range themesByEmployee[emp.UID] {
			themeMonth := TimesheetThemeMonth{UID: th.UID, Name: th.Name, DailyTotals: make([]int, daysInMonth)}

			for _, task := range tasksByTheme[th.UID] {
				taskMonth := TimesheetTaskMonth{UID: task.UID, Name: task.Name, DailyHours: make([]int, daysInMonth)}
				for day := 1; day <= daysInMonth; day++ {
					hours := hoursByTaskDay[task.UID][day]
					taskMonth.DailyHours[day-1] = hours
					themeMonth.DailyTotals[day-1] += hours
					empMonth.DailyTotals[day-1] += hours
				}
				themeMonth.Tasks = append(themeMonth.Tasks, taskMonth)
			}

			empMonth.Themes = append(empMonth.Themes, themeMonth)
		}

		for _, h := range empMonth.DailyTotals {
			empMonth.TotalHours += h
		}
		result.Employees = append(result.Employees, empMonth)
	}

	return result, nil
}

func firstOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// LaborCostsMatrix — разбивка Тема×Сотрудник в процентах от месячных часов,
// основа xlsx-экспорта "Трудозатраты" (issue #40): строка на сотрудника,
// столбец на тему. ThemeNames не фиксирован — темы меняются от месяца к
// месяцу (открываются/закрываются), поэтому список собирается по факту.
type LaborCostsMatrix struct {
	ThemeNames []string
	Rows       []LaborCostsRow
}

type LaborCostsRow struct {
	EmployeeName   string
	TotalHours     int
	PercentByTheme map[string]int
}

// BuildLaborCostsMatrix сворачивает уже полученный TimesheetMonth в матрицу
// экспорта. Если employeeUID задан — остаётся только его строка (под фильтр
// сотрудника на странице).
func BuildLaborCostsMatrix(month *TimesheetMonth, employeeUID *int) LaborCostsMatrix {
	var themeNames []string
	seenTheme := make(map[string]bool)
	var rows []LaborCostsRow

	for _, emp := range month.Employees {
		if employeeUID != nil && emp.UID != *employeeUID {
			continue
		}
		row := LaborCostsRow{EmployeeName: emp.Name, TotalHours: emp.TotalHours, PercentByTheme: make(map[string]int)}
		for _, th := range emp.Themes {
			if !seenTheme[th.Name] {
				seenTheme[th.Name] = true
				themeNames = append(themeNames, th.Name)
			}
			row.PercentByTheme[th.Name] = percentOf(sumInts(th.DailyTotals), emp.TotalHours)
		}
		rows = append(rows, row)
	}

	return LaborCostsMatrix{ThemeNames: themeNames, Rows: rows}
}

func percentOf(part, total int) int {
	if total == 0 {
		return 0
	}
	return int(math.Round(float64(part) / float64(total) * 100))
}

func sumInts(values []int) int {
	total := 0
	for _, v := range values {
		total += v
	}
	return total
}
