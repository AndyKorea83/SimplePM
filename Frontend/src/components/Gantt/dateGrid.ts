import type { GanttScale } from './types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Column width in px and the number of calendar days each column spans, per
// scale (from Figma: day columns are 30px/1 day, week columns ~84px/7 days).
// pxPerDay derives from these so bar positioning stays a single formula
// across scales instead of branching per scale everywhere it's used.
const COLUMN: Record<GanttScale, { width: number; days: number }> = {
  day: { width: 30, days: 1 },
  week: { width: 84, days: 7 },
  month: { width: 30, days: 1 }, // unused: month scale has no design yet
}

export function pxPerDay(scale: GanttScale): number {
  return COLUMN[scale].width / COLUMN[scale].days
}

export function columnWidth(scale: GanttScale): number {
  return COLUMN[scale].width
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY)
}

// Horizontal offset in px of `date` from the grid's range start.
export function dateToX(date: Date, rangeStart: Date, scale: GanttScale): number {
  return daysBetween(rangeStart, date) * pxPerDay(scale)
}

export function durationToWidth(start: Date, finish: Date, scale: GanttScale): number {
  return Math.max(daysBetween(start, finish), 0) * pxPerDay(scale)
}

export type DayColumn = { date: Date; label: string; isToday: boolean }

export function buildDayColumns(start: Date, end: Date, today: Date): DayColumn[] {
  const columns: DayColumn[] = []
  const cursor = startOfDay(start)
  const last = startOfDay(end)
  const todayStart = startOfDay(today)

  while (cursor <= last) {
    columns.push({
      date: new Date(cursor),
      label: String(cursor.getDate()),
      isToday: cursor.getTime() === todayStart.getTime(),
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return columns
}

export type WeekColumn = { start: Date; label: string }

const MONTH_LABELS = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
]

export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`
}

export function buildWeekColumns(start: Date, end: Date): WeekColumn[] {
  const columns: WeekColumn[] = []
  const cursor = startOfDay(start)
  const last = startOfDay(end)

  while (cursor <= last) {
    columns.push({ start: new Date(cursor), label: formatDayMonth(cursor) })
    cursor.setDate(cursor.getDate() + 7)
  }
  return columns
}

export function formatDateRange(start: Date, finish: Date): string {
  const year = finish.getFullYear()
  return `${formatDayMonth(start)} - ${formatDayMonth(finish)}, ${year}`
}

const MONTH_NAMES_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

export type MonthGroup = { label: string; startIndex: number; days: number }

// Groups consecutive day columns by calendar month, for the day-scale
// header's month row and for marking month-boundary gridlines.
export function buildMonthGroups(columns: DayColumn[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  let prevKey = ''

  columns.forEach((column, index) => {
    const key = `${column.date.getFullYear()}-${column.date.getMonth()}`
    if (key === prevKey) {
      groups[groups.length - 1].days += 1
      return
    }
    groups.push({
      label: `${MONTH_NAMES_FULL[column.date.getMonth()]} ${column.date.getFullYear()}`,
      startIndex: index,
      days: 1,
    })
    prevKey = key
  })

  return groups
}
