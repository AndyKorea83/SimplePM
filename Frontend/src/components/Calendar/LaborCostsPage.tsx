import { useEffect, useState } from 'react'
import { downloadLaborCostsReport, fetchTimesheetMonth } from './api'
import { ALL_EMPLOYEES_VALUE, EmployeeSelector } from './EmployeeSelector'
import { MonthPicker, TIMESHEET_RANGE_END } from './MonthPicker'
import { TimeSectionHeader } from './TimeSectionHeader'
import type { TimesheetEmployeeDTO, TimesheetMonthDTO } from './types'

type LaborCostsRow = { label: string; hours: number; percent: number }

function themeRows(employee: TimesheetEmployeeDTO): LaborCostsRow[] {
  return employee.themes.map((theme) => {
    const hours = theme.dailyTotals.reduce((sum, h) => sum + h, 0)
    return { label: theme.name, hours, percent: percentOf(hours, employee.totalHours) }
  })
}

// Сводка для "все сотрудники" — часы по теме суммируются по всем, процент —
// от общего итога по всем, а не от месяца одного человека.
function summaryRows(employees: TimesheetEmployeeDTO[]): { rows: LaborCostsRow[]; totalHours: number } {
  const hoursByTheme = new Map<string, number>()
  let totalHours = 0
  for (const employee of employees) {
    totalHours += employee.totalHours
    for (const theme of employee.themes) {
      const hours = theme.dailyTotals.reduce((sum, h) => sum + h, 0)
      hoursByTheme.set(theme.name, (hoursByTheme.get(theme.name) ?? 0) + hours)
    }
  }
  const rows = [...hoursByTheme.entries()].map(([label, hours]) => ({
    label,
    hours,
    percent: percentOf(hours, totalHours),
  }))
  return { rows, totalHours }
}

function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

function LaborCostsTable({ title, rows, totalHours }: { title: string; rows: LaborCostsRow[]; totalHours: number }) {
  return (
    <div className="mb-6 flex w-full flex-col items-start">
      <p className="mb-2 text-[14px] font-semibold text-[#262933] dark:text-[#f2f2f7]">{title}</p>
      <table className="w-full overflow-hidden rounded-xl border border-[#e0e3e8] text-[13px] dark:border-[#2d313f]">
        <thead>
          <tr className="border-b border-[#e0e3e8] bg-[#f2f5f7] dark:border-[#2d313f] dark:bg-[#181c25]">
            <th className="px-4 py-2 text-left font-medium text-[#595e6b] dark:text-[#999ea8]">Тема</th>
            <th className="px-4 py-2 text-right font-medium text-[#595e6b] dark:text-[#999ea8]">Трудозатраты, ч</th>
            <th className="px-4 py-2 text-right font-medium text-[#595e6b] dark:text-[#999ea8]">Процент</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-[#e0e3e8] last:border-b-0 dark:border-[#2d313f]">
              <td className="px-4 py-2 text-[#262933] dark:text-[#f2f2f7]">{row.label}</td>
              <td className="px-4 py-2 text-right text-[#262933] dark:text-[#f2f2f7]">{row.hours}</td>
              <td className="px-4 py-2 text-right text-[#262933] dark:text-[#f2f2f7]">{row.percent}%</td>
            </tr>
          ))}
          <tr className="bg-[#f2f5f7] dark:bg-[#181c25]">
            <td className="px-4 py-2 font-semibold text-[#262933] dark:text-[#f2f2f7]">Итого</td>
            <td className="px-4 py-2 text-right font-semibold text-[#262933] dark:text-[#f2f2f7]">{totalHours}</td>
            <td className="px-4 py-2 text-right font-semibold text-[#262933] dark:text-[#f2f2f7]">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function LaborCostsPage() {
  const [{ year, month }, setPeriod] = useState(TIMESHEET_RANGE_END)
  const [selectedEmployee, setSelectedEmployee] = useState<number | typeof ALL_EMPLOYEES_VALUE>(ALL_EMPLOYEES_VALUE)
  const [data, setData] = useState<TimesheetMonthDTO | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    fetchTimesheetMonth(year, month)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [year, month])

  const employees = data?.employees ?? []
  const isAllEmployees = selectedEmployee === ALL_EMPLOYEES_VALUE
  const visibleEmployees = isAllEmployees ? employees : employees.filter((e) => e.uid === selectedEmployee)

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-[#111111]">
      <TimeSectionHeader />
      <div className="flex w-full items-center gap-4 px-4 py-[10px]">
        <EmployeeSelector
          employees={employees.map((e) => ({ uid: e.uid, name: e.name }))}
          value={selectedEmployee}
          onChange={setSelectedEmployee}
        />
        <div className="h-px min-w-0 flex-1" />
        <MonthPicker value={{ year, month }} onChange={setPeriod} />
        <button
          type="button"
          onClick={() => downloadLaborCostsReport(year, month, isAllEmployees ? null : selectedEmployee)}
          className="cursor-pointer whitespace-nowrap rounded-lg border border-[#e0e3e8] px-3 py-2 text-[13px] font-medium text-[#475569] dark:border-[#2d313f] dark:text-[#80808c]"
        >
          Скачать xlsx
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-6">
        {error && <p className="py-4 text-[14px] text-[#d93333]">Не удалось загрузить данные: {error}</p>}
        {!error && !data && <p className="py-4 text-[14px] text-[#94a3b8]">Загрузка…</p>}
        {!error && data && (
          <>
            {isAllEmployees &&
              (() => {
                const { rows, totalHours } = summaryRows(employees)
                return rows.length > 0 && <LaborCostsTable title="Все сотрудники" rows={rows} totalHours={totalHours} />
              })()}
            {visibleEmployees.map((employee) => (
              <LaborCostsTable
                key={employee.uid}
                title={employee.name}
                rows={themeRows(employee)}
                totalHours={employee.totalHours}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
