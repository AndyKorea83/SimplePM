import type { TimesheetMonthDTO } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export async function fetchTimesheetMonth(year: number, month: number): Promise<TimesheetMonthDTO> {
  const response = await fetch(`${API_BASE_URL}/api/timesheet?year=${year}&month=${month}`)
  if (!response.ok) {
    throw new Error(`failed to load timesheet: ${response.status}`)
  }
  return response.json()
}
