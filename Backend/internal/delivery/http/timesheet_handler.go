package http

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

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
