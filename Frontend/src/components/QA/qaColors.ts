// Цвета плашек статуса/серьёзности/важности — взяты из Figma
// (kanban-board/bug-report-page/status-history-modal). Статус как цветная
// плашка используется только в истории (модалка "История смены статуса") —
// в Kanban-карточке и таблице отчёта статус рисуется обычным текстом (см.
// сами макеты — там это осознанно разные представления одного поля).

export type ColorPair = { bg: string; text: string }

export const STATUS_PILL_COLORS: Record<string, ColorPair> = {
  'To Do': { bg: '#fee2e2', text: '#991b1b' },
  'In Progress': { bg: '#ffedcc', text: '#995900' },
  'Ready for QA': { bg: '#e5f2ff', text: '#1a59b2' },
  'QA in progress': { bg: '#e0e7ff', text: '#4338ca' },
  Done: { bg: '#d9f5de', text: '#1a8033' },
  // "Создано" — не entity.BugStatus, псевдо-статус первой записи истории
  // (FromStatus == "" на бэкенде) — см. usecase.BugHistoryEntry.
  Created: { bg: '#f0f0f0', text: '#666666' },
}

export function statusPillColor(status: string): ColorPair {
  return STATUS_PILL_COLORS[status] ?? { bg: '#f3f4f6', text: '#374151' }
}

// Критичность (Severity) — по возрастанию: trivial < minor < major <
// critical < blocker. Цвета — официальные именованные токены дизайн-системы
// (severity/blocker, severity/critical и т.д.), найдены на карточке
// "Распределение по критичности" страницы метрик (node 309:8140) — это
// авторитетный источник, отменяет более ранние цвета плашек, подобранные
// по аналогии на других макетах (kanban-card/bug-report-table).
export const SEVERITY_COLORS: Record<string, ColorPair> = {
  blocker: { bg: '#E11D21', text: '#ffffff' },
  critical: { bg: '#9E0B06', text: '#ffffff' },
  major: { bg: '#731705', text: '#ffffff' },
  minor: { bg: '#611F11', text: '#ffffff' },
  trivial: { bg: '#381E1B', text: '#ffffff' },
}

export const SEVERITY_ORDER = ['blocker', 'critical', 'major', 'minor', 'trivial'] as const

// Важность (Priority) для бизнеса — независима от Severity.
export const PRIORITY_COLORS: Record<string, ColorPair> = {
  Low: { bg: '#e5e7eb', text: '#374151' },
  Normal: { bg: '#e5e7eb', text: '#374151' },
  High: { bg: '#fef3c7', text: '#92400e' },
  Critical: { bg: '#fee2e2', text: '#991b1b' },
}

export const LABEL_COLORS: Record<'blocked' | 'paused', ColorPair> = {
  blocked: { bg: '#fee2e2', text: '#991b1b' },
  paused: { bg: '#fef3c7', text: '#92400e' },
}

// "Тема" (проект/подсистема) — открытый список без фиксированной палитры в
// макете; цвет назначается детерминированно по хэшу имени, чтобы одна и та
// же тема всегда рисовалась одним цветом без явного маппинга на бэкенде.
const THEME_PALETTE: ColorPair[] = [
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#ccfbf1', text: '#0f766e' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#ede9fe', text: '#5b21b6' },
  { bg: '#dcfce7', text: '#166534' },
]

export function themeColor(theme: string): ColorPair {
  let hash = 0
  for (let i = 0; i < theme.length; i++) hash = (hash * 31 + theme.charCodeAt(i)) >>> 0
  return THEME_PALETTE[hash % THEME_PALETTE.length]
}
