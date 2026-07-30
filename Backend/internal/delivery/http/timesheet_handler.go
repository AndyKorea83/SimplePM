package http

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/xuri/excelize/v2"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

// TimesheetHandler exposes the "Календарь" page's time-tracking data over HTTP.
type TimesheetHandler struct {
	service usecase.TimesheetService
}

func NewTimesheetHandler(service usecase.TimesheetService) *TimesheetHandler {
	return &TimesheetHandler{service: service}
}

// GetMonth handles GET /api/timesheet?year=2026&month=7.
func (h *TimesheetHandler) GetMonth(w http.ResponseWriter, r *http.Request) {
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil {
		http.Error(w, "year query param must be an integer", http.StatusBadRequest)
		return
	}
	monthNum, err := strconv.Atoi(r.URL.Query().Get("month"))
	if err != nil || monthNum < 1 || monthNum > 12 {
		http.Error(w, "month query param must be an integer 1-12", http.StatusBadRequest)
		return
	}

	month, err := h.service.GetMonth(r.Context(), year, time.Month(monthNum))
	if err != nil {
		log.Printf("get timesheet month: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newTimesheetMonthDTO(month)); err != nil {
		log.Printf("encode timesheet response: %v", err)
	}
}

// ExportLaborCosts обрабатывает GET /api/timesheet/export?year=2026&month=7[&employee=1],
// отдаёт xlsx-отчёт "Трудозатраты" (issue #40): матрица Тема×Сотрудник в
// процентах, по форме приложенного к issue шаблона.
func (h *TimesheetHandler) ExportLaborCosts(w http.ResponseWriter, r *http.Request) {
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil {
		http.Error(w, "year query param must be an integer", http.StatusBadRequest)
		return
	}
	monthNum, err := strconv.Atoi(r.URL.Query().Get("month"))
	if err != nil || monthNum < 1 || monthNum > 12 {
		http.Error(w, "month query param must be an integer 1-12", http.StatusBadRequest)
		return
	}
	var employeeUID *int
	if raw := r.URL.Query().Get("employee"); raw != "" {
		uid, err := strconv.Atoi(raw)
		if err != nil {
			http.Error(w, "employee query param must be an integer", http.StatusBadRequest)
			return
		}
		employeeUID = &uid
	}

	month, err := h.service.GetMonth(r.Context(), year, time.Month(monthNum))
	if err != nil {
		log.Printf("get timesheet month: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	file, err := buildLaborCostsWorkbook(usecase.BuildLaborCostsMatrix(month, employeeUID))
	if err != nil {
		log.Printf("build labor costs workbook: %v", err)
		http.Error(w, "failed to build report", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="trudozatraty_%04d_%02d.xlsx"`, year, monthNum))
	if err := file.Write(w); err != nil {
		log.Printf("write labor costs workbook: %v", err)
	}
}

// buildLaborCostsWorkbook раскладывает матрицу так: имя сотрудника (столбец A),
// по столбцу на тему (процент от месяца этого сотрудника), в конце — "Итого".
// Форма, шрифт (Calibri 11), тонкая чёрная граница по всем ячейкам и ширины
// колонок — точно как в шаблоне, приложенном к issue #40 (без заливки и
// полужирного — в шаблоне их нет вообще).
func buildLaborCostsWorkbook(matrix usecase.LaborCostsMatrix) (*excelize.File, error) {
	f := excelize.NewFile()
	const sheet = "Отчет"
	if err := f.SetSheetName(f.GetSheetName(0), sheet); err != nil {
		return nil, err
	}

	font := &excelize.Font{Family: "Calibri", Size: 11, Color: "000000"}
	border := []excelize.Border{
		{Type: "left", Color: "000000", Style: 1},
		{Type: "right", Color: "000000", Style: 1},
		{Type: "top", Color: "000000", Style: 1},
		{Type: "bottom", Color: "000000", Style: 1},
	}
	labelStyle, err := f.NewStyle(&excelize.Style{Font: font, Border: border, Alignment: &excelize.Alignment{WrapText: true}})
	if err != nil {
		return nil, err
	}
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: font, Border: border,
		Alignment: &excelize.Alignment{Horizontal: "center", WrapText: true},
	})
	if err != nil {
		return nil, err
	}
	valueStyle, err := f.NewStyle(&excelize.Style{
		Font: font, Border: border,
		Alignment: &excelize.Alignment{Horizontal: "right", WrapText: true},
	})
	if err != nil {
		return nil, err
	}

	if err := f.SetCellValue(sheet, "A1", "Сотрудник"); err != nil {
		return nil, err
	}
	themeCol := make([]string, len(matrix.ThemeNames))
	for i, theme := range matrix.ThemeNames {
		col, err := excelize.ColumnNumberToName(i + 2)
		if err != nil {
			return nil, err
		}
		themeCol[i] = col
		if err := f.SetCellValue(sheet, col+"1", theme); err != nil {
			return nil, err
		}
	}
	totalCol, err := excelize.ColumnNumberToName(len(matrix.ThemeNames) + 2)
	if err != nil {
		return nil, err
	}
	if err := f.SetCellValue(sheet, totalCol+"1", "Итого"); err != nil {
		return nil, err
	}

	for i, row := range matrix.Rows {
		rowNum := i + 2
		if err := f.SetCellValue(sheet, fmt.Sprintf("A%d", rowNum), row.EmployeeName); err != nil {
			return nil, err
		}
		for j, theme := range matrix.ThemeNames {
			pct, ok := row.PercentByTheme[theme]
			if !ok || pct == 0 {
				continue
			}
			if err := f.SetCellValue(sheet, fmt.Sprintf("%s%d", themeCol[j], rowNum), pct); err != nil {
				return nil, err
			}
		}
		if err := f.SetCellValue(sheet, fmt.Sprintf("%s%d", totalCol, rowNum), 100); err != nil {
			return nil, err
		}
	}

	lastRow := len(matrix.Rows) + 1
	if err := f.SetCellStyle(sheet, "A1", "A1", labelStyle); err != nil {
		return nil, err
	}
	if err := f.SetCellStyle(sheet, "B1", totalCol+"1", headerStyle); err != nil {
		return nil, err
	}
	if lastRow >= 2 {
		if err := f.SetCellStyle(sheet, "A2", fmt.Sprintf("A%d", lastRow), labelStyle); err != nil {
			return nil, err
		}
		if err := f.SetCellStyle(sheet, "B2", fmt.Sprintf("%s%d", totalCol, lastRow), valueStyle); err != nil {
			return nil, err
		}
	}

	if err := f.SetRowHeight(sheet, 1, 40); err != nil {
		return nil, err
	}
	if err := f.SetColWidth(sheet, "A", "A", 23.43); err != nil {
		return nil, err
	}
	if err := f.SetColWidth(sheet, "B", totalCol, 10); err != nil {
		return nil, err
	}

	return f, nil
}
