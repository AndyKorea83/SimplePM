import type { ProjectDTO } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export async function fetchProject(): Promise<ProjectDTO> {
  const response = await fetch(`${API_BASE_URL}/api/project`)
  if (!response.ok) {
    throw new Error(`failed to load project: ${response.status}`)
  }
  return response.json()
}
