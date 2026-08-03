import type { DependencyDTO, ProjectDTO, TaskDTO } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export async function fetchProject(projectId: number): Promise<ProjectDTO> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`)
  if (!response.ok) {
    throw new Error(`failed to load project: ${response.status}`)
  }
  return response.json()
}

export type CreateTaskRequest = {
  name: string
  parentUid?: number
  start: string
  finish: string
  percentComplete: number
  isMilestone: boolean
  isBlocked: boolean
  assigneeResourceUids: number[]
  dependencies: DependencyDTO[]
}

export type UpdateTaskRequest = {
  name?: string
  start?: string
  finish?: string
  percentComplete?: number
  isBlocked?: boolean
  assigneeResourceUids?: number[]
  dependencies?: DependencyDTO[]
}

async function unwrap(response: Response, fallbackMessage: string): Promise<Response> {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || fallbackMessage)
  }
  return response
}

export async function createTask(projectId: number, input: CreateTaskRequest): Promise<TaskDTO> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return (await unwrap(response, `failed to create task: ${response.status}`)).json()
}

export async function updateTask(projectId: number, uid: number, input: UpdateTaskRequest): Promise<TaskDTO> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/tasks/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return (await unwrap(response, `failed to update task: ${response.status}`)).json()
}

export async function deleteTask(projectId: number, uid: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/tasks/${uid}`, { method: 'DELETE' })
  await unwrap(response, `failed to delete task: ${response.status}`)
}
