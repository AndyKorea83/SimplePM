// Mirrors src/Backend/internal/delivery/http/dto.go::projectSummaryDTO

export type ProjectSummaryDTO = {
  id: number
  name: string
  title: string
  description?: string
  createdBy: string
  createdAt: string
  computedFinish: string
  taskTotal: number
  taskDone: number
  behindSchedule: boolean
}
