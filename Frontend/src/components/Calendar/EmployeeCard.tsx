import type { TimesheetEmployeeDTO } from './types'

const TASK_COL_WIDTH = 350

function isWeekendDay(year: number, month: number, day: number): boolean {
  const weekday = new Date(year, month - 1, day).getDay()
  return weekday === 0 || weekday === 6
}

type DayCellProps = {
  value: number
  isWeekend: boolean
  // Only the top "Общие трудозатраты" row explicitly shows "0" and colors
  // exactly-8/anomaly hours — theme/task rows just show blank when empty.
  showZeroAndColor?: boolean
}

function DayCell({ value, isWeekend, showZeroAndColor }: DayCellProps) {
  let background: string | undefined
  let color = '#262933'

  if (isWeekend) {
    background = 'rgba(237, 240, 245, 0.4)'
  } else if (showZeroAndColor && value > 0) {
    const isFullDay = value === 8
    background = isFullDay ? 'rgba(15, 186, 130, 0.1)' : 'rgba(229, 51, 51, 0.1)'
    color = isFullDay ? '#0d8c61' : '#f24d4d'
  }

  const label = value > 0 ? value : showZeroAndColor && !isWeekend ? 0 : ''

  return (
    <div
      className="flex h-full min-w-0 flex-1 flex-col items-center justify-center border-l border-[#e0e3e8]"
      style={{ backgroundColor: background }}
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
  const days = Array.from({ length: employee.dailyTotals.length }, (_, i) => i + 1)

  return (
    <div className="flex w-full flex-col items-start px-4">
      <div className="flex w-full items-center justify-between pb-2 pt-5">
        <p className="text-[14px] font-semibold text-[#262933]">{employee.name}</p>
        <p className="text-[13px] font-medium text-[#737885]">Часов за месяц: {employee.totalHours}</p>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-[#e0e3e8] bg-white">
        <div className="flex h-11 w-full border-b border-[#e0e3e8]">
          <div className="flex h-full shrink-0 items-center px-4" style={{ width: TASK_COL_WIDTH }}>
            <p className="truncate text-[14px] font-medium text-[#262933]">Задачи</p>
          </div>
          <div className="flex h-full min-w-0 flex-1">
            {days.map((day) => (
              <div
                key={day}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-center border-l border-[#e0e3e8]"
                style={{ backgroundColor: isWeekendDay(year, month, day) ? 'rgba(237, 240, 245, 0.4)' : undefined }}
              >
                <p className="text-[12px] font-medium text-[#595e6b]">{day}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex h-[38px] w-full border-b-2 border-[#e0e3e8]">
          <div className="flex h-full shrink-0 items-center px-4" style={{ width: TASK_COL_WIDTH }}>
            <p className="text-[13px] text-[#262933]">Общие трудозатраты</p>
          </div>
          <div className="flex h-full min-w-0 flex-1">
            {employee.dailyTotals.map((value, i) => (
              <DayCell key={i} value={value} isWeekend={isWeekendDay(year, month, i + 1)} showZeroAndColor />
            ))}
          </div>
        </div>

        {employee.themes.map((theme) => (
          <div key={theme.uid} className="flex w-full flex-col items-start">
            <div className="flex h-[34px] w-full border-b border-[#e0e3e8] bg-[#f2f5f7]">
              <div className="flex h-full shrink-0 items-center px-4" style={{ width: TASK_COL_WIDTH }}>
                <p className="truncate text-[12px] font-medium text-[#d89425]">{theme.name}</p>
              </div>
              <div className="flex h-full min-w-0 flex-1">
                {theme.dailyTotals.map((value, i) => (
                  <DayCell key={i} value={value} isWeekend={isWeekendDay(year, month, i + 1)} />
                ))}
              </div>
            </div>

            {theme.tasks.map((task) => (
              <div key={task.uid} className="flex h-8 w-full border-b border-[#e0e3e8]">
                <div className="flex h-full min-w-0 shrink-0 items-center px-4" style={{ width: TASK_COL_WIDTH }}>
                  <p className="truncate text-[12px] text-[#3b82f6]">{task.name}</p>
                </div>
                <div className="flex h-full min-w-0 flex-1">
                  {task.dailyHours.map((value, i) => (
                    <DayCell key={i} value={value} isWeekend={isWeekendDay(year, month, i + 1)} />
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
