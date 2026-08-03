import { useEffect, useState } from 'react'
import downloadIcon from '../../assets/icons/download.svg'
import { Button } from '../ui/Button'
import { PageShell } from '../ui/PageShell'
import { downloadLaborCostsReport, fetchTimesheetMonth } from './api'
import { ALL_EMPLOYEES_VALUE, EmployeeSelector } from './EmployeeSelector'
import { MonthPicker, TIMESHEET_RANGE_END } from './MonthPicker'
import { TimeSectionHeader } from './TimeSectionHeader'
import type { TimesheetEmployeeDTO, TimesheetMonthDTO } from './types'

type LaborCostsRow = { label: string; hours: number; percent: number }

// Figma (233:7500, Workload/Row color-dot) — палитра секторов круговой
// диаграммы, по кругу для тем сверх пяти цветов.
const PIE_COLORS = ['#45BA9E', '#ED945C', '#5978D9', '#407857', '#333873']

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

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

// Обычный SVG pie-chart (без сторонних библиотек) — сектор на тему, тот же
// цвет, что у color-dot её строки в таблице (Figma 233:7537).
function PieChart({ slices }: { slices: { percent: number; color: string }[] }) {
  const size = 130
  const r = size / 2
  let angle = 0
  const arcs = slices
    .filter((slice) => slice.percent > 0)
    .map((slice, i) => {
      const start = angle
      angle += (slice.percent / 100) * 360
      const end = angle
      if (end - start >= 360) {
        return <circle key={i} cx={r} cy={r} r={r} fill={slice.color} />
      }
      const from = polarPoint(r, r, r, start)
      const to = polarPoint(r, r, r, end)
      const largeArc = end - start > 180 ? 1 : 0
      return (
        <path
          key={i}
          d={`M${r},${r} L${from.x},${from.y} A${r},${r} 0 ${largeArc} 1 ${to.x},${to.y} Z`}
          fill={slice.color}
        />
      )
    })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {arcs}
    </svg>
  )
}

// Таблица + диаграмма фиксированной ширины (Figma: 480px таблица + 130px
// диаграмма) — не растягивается на всю страницу и не гуляет по колонкам.
function LaborCostsTable({ title, rows, totalHours }: { title: string; rows: LaborCostsRow[]; totalHours: number }) {
  return (
    <div className="mb-8 flex flex-col items-start gap-3">
      <p className="text-[16px] font-bold text-[var(--text-primary)]">{title}</p>
      <div className="flex items-center gap-8">
        <div className="flex w-[480px] flex-col items-start">
          <div className="flex h-[30px] w-full items-center border-b border-[#d9dbe5] py-2 text-[12px] font-medium text-[#737a8c] dark:border-[#2d313f] dark:text-[#999ea8]">
            <p className="w-[250px] truncate">Тема</p>
            <p className="w-[120px] text-right">Трудозатраты (ч)</p>
            <p className="w-[70px] text-right">Процент</p>
          </div>
          {rows.map((row, i) => (
            <div key={row.label} className="flex h-[32px] w-full items-center py-2 text-[13px] text-[var(--text-primary)]">
              <p className="w-[250px] truncate">{row.label}</p>
              <p className="w-[120px] text-right">{row.hours}</p>
              <p className="w-[70px] text-right">{row.percent}%</p>
              <span
                className="ml-2 size-[10px] shrink-0 rounded-full"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
            </div>
          ))}
          <div className="flex h-[32px] w-full items-center border-t border-[#d9dbe5] py-2 text-[13px] font-semibold text-[var(--text-primary)] dark:border-[#2d313f]">
            <p className="w-[250px]">Всего часов</p>
            <p className="w-[120px] text-right">{totalHours}</p>
            <p className="w-[70px] text-right">100%</p>
          </div>
        </div>
        <PieChart slices={rows.map((row, i) => ({ percent: row.percent, color: PIE_COLORS[i % PIE_COLORS.length] }))} />
      </div>
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
    <PageShell>
      <TimeSectionHeader />
      <div className="flex w-full items-start gap-4 px-4 py-[10px]">
        <EmployeeSelector
          employees={employees.map((e) => ({ uid: e.uid, name: e.name, team: e.team }))}
          value={selectedEmployee}
          onChange={setSelectedEmployee}
        />
        <div className="h-px min-w-0 flex-1" />
        <Button
          variant="success"
          className="shrink-0"
          onClick={() => downloadLaborCostsReport(year, month, isAllEmployees ? null : selectedEmployee)}
        >
          <img src={downloadIcon} alt="" className="size-[14px] shrink-0" />
          Выгрузить в Excel
        </Button>
        <MonthPicker value={{ year, month }} onChange={setPeriod} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        {error && <p className="py-4 text-[14px] text-[#d93333]">Не удалось загрузить данные: {error}</p>}
        {!error && !data && <p className="py-4 text-[14px] text-[#94a3b8]">Загрузка…</p>}
        {!error && data && (
          <>
            {isAllEmployees &&
              (() => {
                const { rows, totalHours } = summaryRows(employees)
                return rows.length > 0 && <LaborCostsTable title="Общие трудозатраты" rows={rows} totalHours={totalHours} />
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
    </PageShell>
  )
}
