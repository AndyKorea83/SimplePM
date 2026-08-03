import type { ProjectDTO } from '../Gantt/types'
import type { ProjectSummaryDTO } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

async function unwrap(response: Response, fallbackMessage: string): Promise<Response> {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || fallbackMessage)
  }
  return response
}

export async function fetchProjectSummaries(): Promise<ProjectSummaryDTO[]> {
  const response = await fetch(`${API_BASE_URL}/api/projects`)
  return (await unwrap(response, `failed to load projects: ${response.status}`)).json()
}

export type CreateProjectRequest = {
  name: string
  description?: string
}

export async function createProject(input: CreateProjectRequest): Promise<ProjectDTO> {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return (await unwrap(response, `failed to create project: ${response.status}`)).json()
}

export async function updateProject(id: number, input: CreateProjectRequest): Promise<ProjectDTO> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return (await unwrap(response, `failed to update project: ${response.status}`)).json()
}

// Открыть/закрыть проект — тот же PATCH-эндпоинт метаданных, отдельное
// булево поле, а не свой роут.
export async function setProjectClosed(id: number, closed: boolean): Promise<ProjectDTO> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closed }),
  })
  return (await unwrap(response, `failed to ${closed ? 'close' : 'open'} project: ${response.status}`)).json()
}

export type ImportProjectRequest = {
  name: string
  description?: string
  file: File
}

export async function importProject(input: ImportProjectRequest): Promise<ProjectDTO> {
  const form = new FormData()
  form.set('name', input.name)
  if (input.description) form.set('description', input.description)
  form.set('file', input.file)

  const response = await fetch(`${API_BASE_URL}/api/projects/import`, { method: 'POST', body: form })
  return (await unwrap(response, `failed to import project: ${response.status}`)).json()
}

// Прямая ссылка-клик, а не fetch+blob — тот же паттерн, что
// Calendar/api.ts::downloadLaborCostsReport (сервер сам отдаёт файл через
// Content-Disposition: attachment).
export function downloadProjectExport(id: number) {
  const link = document.createElement('a')
  link.href = `${API_BASE_URL}/api/projects/${id}/export`
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
