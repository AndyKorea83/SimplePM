import type { BugHistoryViewDTO, KanbanColumnDTO, PersonBugsDTO, QAMetricsDTO } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

async function unwrap(response: Response, fallbackMessage: string): Promise<Response> {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || fallbackMessage)
  }
  return response
}

export async function fetchKanban(): Promise<KanbanColumnDTO[]> {
  const response = await fetch(`${API_BASE_URL}/api/qa/kanban`)
  return (await unwrap(response, `failed to load kanban board: ${response.status}`)).json()
}

export async function updateBugStatus(uid: number, status: string) {
  const response = await fetch(`${API_BASE_URL}/api/qa/bugs/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  return (await unwrap(response, `failed to update bug status: ${response.status}`)).json()
}

export async function fetchBugReport(): Promise<PersonBugsDTO[]> {
  const response = await fetch(`${API_BASE_URL}/api/qa/bug-report`)
  return (await unwrap(response, `failed to load bug report: ${response.status}`)).json()
}

export async function fetchBugHistory(uid: number): Promise<BugHistoryViewDTO> {
  const response = await fetch(`${API_BASE_URL}/api/qa/bugs/${uid}/history`)
  return (await unwrap(response, `failed to load bug history: ${response.status}`)).json()
}

export async function fetchQAMetrics(year: number, month: number): Promise<QAMetricsDTO> {
  const response = await fetch(`${API_BASE_URL}/api/qa/metrics?year=${year}&month=${month}`)
  return (await unwrap(response, `failed to load qa metrics: ${response.status}`)).json()
}
