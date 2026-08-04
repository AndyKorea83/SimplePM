package http

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
	"github.com/AndyKorea83/SimplePM/src/Backend/internal/usecase"
)

// QAHandler отдаёт данные раздела QA (Kanban-доска/отчёт по багам/история/
// метрики) по HTTP.
type QAHandler struct {
	service usecase.QAService
}

// NewQAHandler строит QAHandler поверх service.
func NewQAHandler(service usecase.QAService) *QAHandler {
	return &QAHandler{service: service}
}

// ListKanban обрабатывает GET /api/qa/kanban.
func (h *QAHandler) ListKanban(w http.ResponseWriter, r *http.Request) {
	columns, err := h.service.ListKanban(r.Context())
	if err != nil {
		log.Printf("list kanban: %v", err)
		http.Error(w, "failed to load kanban board", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newKanbanColumnDTOs(columns)); err != nil {
		log.Printf("encode kanban response: %v", err)
	}
}

type updateBugStatusRequest struct {
	Status string `json:"status"`
}

// UpdateBugStatus обрабатывает PATCH /api/qa/bugs/{uid} — перетаскивание
// карточки между колонками Kanban-доски.
func (h *QAHandler) UpdateBugStatus(w http.ResponseWriter, r *http.Request) {
	uid, err := strconv.Atoi(chi.URLParam(r, "uid"))
	if err != nil {
		http.Error(w, "invalid bug uid", http.StatusBadRequest)
		return
	}

	var req updateBugStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	bug, err := h.service.UpdateBugStatus(r.Context(), uid, entity.BugStatus(req.Status))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newBugDTO(bug)); err != nil {
		log.Printf("encode updated bug response: %v", err)
	}
}

// ListBugReport обрабатывает GET /api/qa/bug-report — та же выборка багов,
// что Kanban-доска (включая Done), сгруппированная по исполнителю.
func (h *QAHandler) ListBugReport(w http.ResponseWriter, r *http.Request) {
	groups, err := h.service.ListBugReport(r.Context())
	if err != nil {
		log.Printf("list bug report: %v", err)
		http.Error(w, "failed to load bug report", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newPersonBugsDTOs(groups)); err != nil {
		log.Printf("encode bug report response: %v", err)
	}
}

// GetBugHistory обрабатывает GET /api/qa/bugs/{uid}/history — модалка
// "История смены статуса".
func (h *QAHandler) GetBugHistory(w http.ResponseWriter, r *http.Request) {
	uid, err := strconv.Atoi(chi.URLParam(r, "uid"))
	if err != nil {
		http.Error(w, "invalid bug uid", http.StatusBadRequest)
		return
	}

	view, err := h.service.GetHistory(r.Context(), uid)
	if err != nil {
		log.Printf("get bug history: %v", err)
		http.Error(w, "bug not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newBugHistoryViewDTO(view)); err != nil {
		log.Printf("encode bug history response: %v", err)
	}
}

// GetMetrics обрабатывает GET /api/qa/metrics?year=2026&month=7.
func (h *QAHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
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

	metrics, err := h.service.GetMetrics(r.Context(), year, time.Month(monthNum))
	if err != nil {
		log.Printf("get qa metrics: %v", err)
		http.Error(w, "failed to compute metrics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newQAMetricsDTO(metrics)); err != nil {
		log.Printf("encode qa metrics response: %v", err)
	}
}
