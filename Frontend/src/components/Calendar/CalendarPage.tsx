import { useEffect, useState } from 'react'
import { fetchTimesheetMonth } from './api'
import { EmployeeCard } from './EmployeeCard'
import { ALL_EMPLOYEES_VALUE, EmployeeSelector } from './EmployeeSelector'
import { MonthPicker, TIMESHEET_RANGE_END } from './MonthPicker'
import { TimeSectionHeader } from './TimeSectionHeader'
import type { TimesheetMonthDTO } from './types'

export function CalendarPage() {
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
  const visibleEmployees =
    selectedEmployee === ALL_EMPLOYEES_VALUE ? employees : employees.filter((e) => e.uid === selectedEmployee)

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-[#111111]">
      <TimeSectionHeader activeTab="calendar" />
      <div className="flex w-full items-start gap-4 px-4 py-[10px]">
        <EmployeeSelector
          employees={employees.map((e) => ({ uid: e.uid, name: e.name }))}
          value={selectedEmployee}
          onChange={setSelectedEmployee}
        />
        <div className="h-px min-w-0 flex-1" />
        <MonthPicker value={{ year, month }} onChange={setPeriod} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-6">
        {error && <p className="px-4 py-4 text-[14px] text-[#d93333]">Не удалось загрузить данные: {error}</p>}
        {!error && !data && <p className="px-4 py-4 text-[14px] text-[#94a3b8]">Загрузка…</p>}
        {!error &&
          data &&
          visibleEmployees.map((employee) => (
            <EmployeeCard key={employee.uid} employee={employee} year={year} month={month} />
          ))}
      </div>
    </div>
  )
}
