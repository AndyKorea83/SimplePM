import { startOfDay } from './dateGrid'
import type { TaskDTO } from './types'

export type TaskStatus = 'complete' | 'inWork' | 'planned' | 'overdue' | 'blocked'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  complete: 'Готово',
  inWork: 'В работе',
  planned: 'План',
  overdue: 'Просрочено',
  blocked: 'Блок',
}

// Solid fill color per status. "planned" has no fill in the design (dashed
// outline instead) — see STATUS_OUTLINE.
export const STATUS_COLORS: Record<TaskStatus, string> = {
  complete: '#0FBA82',
  inWork: '#4078D9',
  planned: '#616B8A',
  overdue: '#FF974C',
  blocked: '#D93333',
}

export function deriveStatus(task: TaskDTO, today: Date): TaskStatus {
  if (task.isBlocked) return 'blocked'
  if (task.percentComplete >= 100) return 'complete'
  // Compare calendar days only — a task finishing "today" (regardless of
  // its stored time-of-day) is not yet overdue; it becomes overdue only
  // once its finish day is strictly in the past.
  if (startOfDay(new Date(task.finish)) < startOfDay(today) && task.percentComplete < 100) return 'overdue'
  if (task.percentComplete > 0) return 'inWork'
  return 'planned'
}
