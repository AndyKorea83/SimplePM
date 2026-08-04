// Зеркалит src/Backend/internal/delivery/http/qa_dto.go

export type BugDTO = {
  uid: number
  title: string
  theme: string
  assigneeName: string
  reporterName: string
  status: string
  severity: string
  priority: string
  isBlocked: boolean
  isPaused: boolean
  isQuestion: boolean
  deadline?: string
  createdAt: string
}

export type KanbanColumnDTO = {
  key: string
  title: string
  bugs: BugDTO[]
}

export type PersonBugsDTO = {
  assigneeName: string
  bugs: BugDTO[]
}

export type BugHistoryEntryDTO = {
  kind: 'status' | 'label_added' | 'label_removed'
  at: string
  byName: string
  fromStatus?: string
  toStatus?: string
  label?: string
}

export type BugHistoryViewDTO = {
  bug: BugDTO
  entries: BugHistoryEntryDTO[]
  totalChanges: number
  lifetimeDays: number
  lifetimeHours: number
}

export type MonthlySeverityDTO = {
  year: number
  month: number
  total: number
  bySeverity: Record<string, number>
}

export type ProjectStatDTO = {
  theme: string
  created: number
  closed: number
  avgLifetimeDays: number
  maxLifetimeDays: number
  avgTransfers: number
  maxTransfers: number
}

export type LeaderboardEntryDTO = {
  reporterName: string
  total: number
  bySeverity: Record<string, number>
}

export type AttentionItemDTO = {
  bug: BugDTO
  value: string
}

export type QAMetricsDTO = {
  selectedMonth: MonthlySeverityDTO
  monthlyDistribution: MonthlySeverityDTO[]
  totalBugs: number
  projectStats: ProjectStatDTO[]
  leaderboard: LeaderboardEntryDTO[]
  tooLong: AttentionItemDTO[]
  tooManyTransfers: AttentionItemDTO[]
  questions: BugDTO[]
}
