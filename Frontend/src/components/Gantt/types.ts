// Mirrors src/Backend/internal/delivery/http/dto.go

export type DependencyDTO = {
  predecessorUid: number
  type: number
}

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
  name: string
  title: string
  startDate: string
  finishDate: string
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
