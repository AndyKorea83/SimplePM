import type { TimesheetEmployeeDTO } from './types'
import { useTheme } from '../../theme/ThemeContext'

const TASK_COL_WIDTH = 350

// Ширина карточки зафиксирована, а не растягивается на всю ширину: при
// развёрнутом сайдбаре (220px) и окне 1920px справа должно оставаться 80px —
// 1920 − 220 − 16(левый px-4) − 80 = 1604.
const CARD_WIDTH = 1604

function isWeekendDay(year: number, month: number, day: number): boolean {
  const weekday = new Date(year, month - 1, day).getDay()
  return weekday === 0 || weekday === 6
}

type DayCellProps = {
  value: number
  isWeekend: boolean
  width: number
  // Only the top "Общие трудозатраты" row explicitly shows "0" and colors
  // exactly-8/anomaly hours — theme/task rows just show blank when empty.
  showZeroAndColor?: boolean
}

// Figma (187:6001, Timesheet/Employee-Card): dark variant re-tints weekend
// shading and the full-day/anomaly highlight, but keeps the anomaly text
// color (#f24d4d) identical to light — only its background opacity changes.
function DayCell({ value, isWeekend, width, showZeroAndColor }: DayCellProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  let background: string | undefined
  let color = isDark ? '#f2f2f7' : '#262933'

  if (isWeekend) {
    background = isDark ? 'rgba(38, 43, 61, 0.5)' : 'rgba(237, 240, 245, 0.4)'
  } else if (showZeroAndColor && value > 0) {
    const isFullDay = value === 8
    background = isFullDay
      ? isDark
        ? 'rgba(15, 186, 130, 0.15)'
        : 'rgba(15, 186, 130, 0.1)'
      : isDark
        ? 'rgba(229, 51, 51, 0.15)'
        : 'rgba(229, 51, 51, 0.1)'
    color = isFullDay ? (isDark ? '#33d499' : '#0d8c61') : '#f24d4d'
  }

  const label = value > 0 ? value : showZeroAndColor && !isWeekend ? 0 : ''

  return (
    <div
      className="flex h-full shrink-0 flex-col items-center justify-center border-l border-[#e0e3e8] dark:border-[#2d313f]"
      style={{ backgroundColor: background, width }}
    >
      <p className="text-center text-[12px]" style={{ color }}>
        {label}
      </p>
    </div>
  )
}

type EmployeeCardProps = {
  employee: TimesheetEmployeeDTO
  year: number
  month: number
}

export function EmployeeCard({ employee, year, month }: EmployeeCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const days = Array.from({ length: employee.dailyTotals.length }, (_, i) => i + 1)
  const dayColWidth = (CARD_WIDTH - TASK_COL_WIDTH) / days.length
  const weekendBg = isDark ? 'rgba(38, 43, 61, 0.5)' : 'rgba(237, 240, 245, 0.4)'

  return (
    <div className="flex w-full flex-col items-start px-4">
      <div className="flex items-center justify-between pb-2 pt-5" style={{ width: CARD_WIDTH }}>
        <p className="text-[14px] font-semibold text-[#262933] dark:text-[#f2f2f7]">{employee.name}</p>
        <p className="text-[13px] font-medium text-[#737885] dark:text-[#999ea8]">
          Часов за месяц: {employee.totalHours}
        </p>
      </div>

      <div
        className="overflow-hidden rounded-xl border border-[#e0e3e8] bg-white dark:border-[#2d313f] dark:bg-[#1d1f27]"
        style={{ width: CARD_WIDTH }}
      >
        <div className="flex h-11 w-full border-b border-[#e0e3e8] dark:border-[#2d313f] dark:bg-[#1e2230]">
          <div className="flex h-full shrink-0 items-center px-4" style={{ width: TASK_COL_WIDTH }}>
            <p className="truncate text-[14px] font-medium text-[#262933] dark:text-[#f2f2f7]">Задачи</p>
          </div>
          <div className="flex h-full">
            {days.map((day) => (
              <div
                key={day}
                className="flex h-full shrink-0 flex-col items-center justify-center border-l border-[#e0e3e8] dark:border-[#2d313f]"
                style={{ width: dayColWidth, backgroundColor: isWeekendDay(year, month, day) ? weekendBg : undefined }}
              >
                <p className="text-[12px] font-medium text-[#595e6b] dark:text-[#999ea8]">{day}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex h-[38px] w-full border-b-2 border-[#e0e3e8] dark:border-[#2d313f]">
          <div className="flex h-full shrink-0 items-center px-4" style={{ width: TASK_COL_WIDTH }}>
            <p className="text-[13px] text-[#262933] dark:text-[#f2f2f7]">Общие трудозатраты</p>
          </div>
          <div className="flex h-full">
            {employee.dailyTotals.map((value, i) => (
              <DayCell
                key={i}
                value={value}
                isWeekend={isWeekendDay(year, month, i + 1)}
                width={dayColWidth}
                showZeroAndColor
              />
            ))}
          </div>
        </div>

        {employee.themes.map((theme) => (
          <div key={theme.uid} className="flex w-full flex-col items-start">
            <div className="flex h-[34px] w-full border-b border-[#e0e3e8] bg-[#f2f5f7] dark:border-[#2d313f] dark:bg-[#181c25]">
              <div className="flex h-full shrink-0 items-center px-4" style={{ width: TASK_COL_WIDTH }}>
                <p className="truncate text-[12px] font-medium text-[#d89425]">{theme.name}</p>
              </div>
              <div className="flex h-full">
                {theme.dailyTotals.map((value, i) => (
                  <DayCell key={i} value={value} isWeekend={isWeekendDay(year, month, i + 1)} width={dayColWidth} />
                ))}
              </div>
            </div>

            {theme.tasks.map((task) => (
              <div key={task.uid} className="flex h-8 w-full border-b border-[#e0e3e8] dark:border-[#2d313f]">
                <div className="flex h-full min-w-0 shrink-0 items-center px-4" style={{ width: TASK_COL_WIDTH }}>
                  <p className="truncate text-[12px] text-[#3b82f6]">{task.name}</p>
                </div>
                <div className="flex h-full">
                  {task.dailyHours.map((value, i) => (
                    <DayCell key={i} value={value} isWeekend={isWeekendDay(year, month, i + 1)} width={dayColWidth} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
