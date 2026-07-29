package usecase_test

import (
	"context"
	"testing"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/timesheet"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

func TestTimesheetService_GetMonth_TotalsMatchDailySums(t *testing.T) {
	service := usecase.NewTimesheetService(timesheet.Generate(), timesheet.RangeStart, timesheet.RangeEnd)

	month, err := service.GetMonth(context.Background(), 2025, time.August)
	if err != nil {
		t.Fatalf("GetMonth: %v", err)
	}
	if month.DaysInMonth != 31 {
		t.Errorf("DaysInMonth = %d, want 31", month.DaysInMonth)
	}
	if len(month.Employees) == 0 {
		t.Fatal("expected at least one employee")
	}

	for _, emp := range month.Employees {
		wantTotal := sum(emp.DailyTotals)
		if emp.TotalHours != wantTotal {
			t.Errorf("employee %q TotalHours = %d, want %d (sum of DailyTotals)", emp.Name, emp.TotalHours, wantTotal)
		}

		for day, total := range emp.DailyTotals {
			var themeSum int
			for _, th := range emp.Themes {
				themeSum += th.DailyTotals[day]
			}
			if themeSum != total {
				t.Errorf("employee %q day %d: sum of theme totals = %d, want %d", emp.Name, day+1, themeSum, total)
			}
		}

		for _, th := range emp.Themes {
			for day, total := range th.DailyTotals {
				var taskSum int
				for _, task := range th.Tasks {
					taskSum += task.DailyHours[day]
				}
				if taskSum != total {
					t.Errorf("employee %q theme %q day %d: sum of task hours = %d, want %d", emp.Name, th.Name, day+1, taskSum, total)
				}
			}
		}
	}
}

func TestTimesheetService_GetMonth_OutsideRange(t *testing.T) {
	service := usecase.NewTimesheetService(timesheet.Generate(), timesheet.RangeStart, timesheet.RangeEnd)

	if _, err := service.GetMonth(context.Background(), 2024, time.January); err == nil {
		t.Fatal("expected error for a month before the dataset's range, got nil")
	}
	if _, err := service.GetMonth(context.Background(), 2027, time.January); err == nil {
		t.Fatal("expected error for a month after the dataset's range, got nil")
	}
}

func sum(values []int) int {
	total := 0
	for _, v := range values {
		total += v
	}
	return total
}
