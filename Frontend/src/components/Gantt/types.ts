// Зеркалит src/Backend/internal/delivery/http/dto.go

export type DependencyDTO = {
  predecessorUid: number
  type: number
}

// Порядок значений — как в backend entity.DependencyType (не алфавитный,
// повторяет нумерацию MSPDI): ОО=0, ОН=1, НО=2, НН=3.
export const DEPENDENCY_TYPE_OPTIONS = [
  { value: 0, label: 'ОО' },
  { value: 1, label: 'ОН' },
  { value: 2, label: 'НО' },
  { value: 3, label: 'НН' },
] as const

export type TaskDTO = {
  uid: number
  id: number
  name: string
  wbs: string
  parentUid?: number
  outlineLevel: number
  start: string
  finish: string
  durationHours: number
  percentComplete: number
  isMilestone: boolean
  isSummary: boolean
  isBlocked: boolean
  dependencies?: DependencyDTO[]
}

export type ResourceDTO = {
  uid: number
  name: string
  initials?: string
  group?: string
  email?: string
}

export type AssignmentDTO = {
  uid: number
  taskUid: number
  resourceUid: number
  units: number
  workHours: number
}

export type ProjectDTO = {
  id: number
  name: string
  title: string
  description?: string
  createdBy: string
  createdAt: string
  startDate: string
  finishDate: string
  closed: boolean
  closedAt?: string
  tasks: TaskDTO[]
  resources: ResourceDTO[]
  assignments: AssignmentDTO[]
}

export type GanttTaskNode = TaskDTO & {
  depth: number
  children: GanttTaskNode[]
}

export type GanttScale = 'day' | 'week' | 'month'
export type GanttDensity = 'default' | 'compact' | 'dense'
