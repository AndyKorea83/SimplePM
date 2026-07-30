import type { TimesheetMonthDTO } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export async function fetchTimesheetMonth(year: number, month: number): Promise<TimesheetMonthDTO> {
  const response = await fetch(`${API_BASE_URL}/api/timesheet?year=${year}&month=${month}`)
  if (!response.ok) {
    throw new Error(`failed to load timesheet: ${response.status}`)
  }
  return response.json()
}

// Скачивание xlsx-отчёта "Трудозатраты" через одноразовую <a> — backend сам
// ставит Content-Disposition, поэтому переход по SPA-роутам не ломается.
export function downloadLaborCostsReport(year: number, month: number, employeeUid: number | null) {
  const params = new URLSearchParams({ year: String(year), month: String(month) })
  if (employeeUid !== null) params.set('employee', String(employeeUid))
  const link = document.createElement('a')
  link.href = `${API_BASE_URL}/api/timesheet/export?${params.toString()}`
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
