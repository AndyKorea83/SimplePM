import type { GanttScale } from './types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Column width in px and the number of calendar days each column spans, per
// scale (from Figma: day columns are 30px/1 day, week columns ~84px/7 days).
// pxPerDay derives from these so bar positioning stays a single formula
// across scales instead of branching per scale everywhere it's used.
// Month has no Figma design — months have a variable day count, so unlike
// day/week its columns aren't a uniform width; only the px-per-day rate is
// fixed here (buildMonthColumns derives each column's actual width from it).
const COLUMN: Record<'day' | 'week', { width: number; days: number }> = {
  day: { width: 30, days: 1 },
  week: { width: 84, days: 7 },
}
const MONTH_PX_PER_DAY = 4

export function pxPerDay(scale: GanttScale): number {
  if (scale === 'month') return MONTH_PX_PER_DAY
  return COLUMN[scale].width / COLUMN[scale].days
}

// Meaningful only for day/week, whose columns are uniform width.
export function columnWidth(scale: 'day' | 'week'): number {
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

// Inverse of dateToX: the date at horizontal offset x from rangeStart.
export function xToDate(x: number, rangeStart: Date, scale: GanttScale): Date {
  const days = Math.round(x / pxPerDay(scale))
  const date = startOfDay(rangeStart)
  date.setDate(date.getDate() + days)
  return date
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

// Groups consecutive days by calendar month, for the day-scale header's
// month row, for marking month-boundary gridlines, and (via
// buildMonthColumns below) as the columns of the month scale itself.
export function buildMonthGroups(columns: { date: Date }[]): MonthGroup[] {
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

// The month scale's columns: one per calendar month covered by the range,
// each spanning its actual (possibly partial, at the range's edges) day
// count. group.startIndex is a day-offset from `start`, so a column's pixel
// position is startIndex * pxPerDay('month') — the same formula dateToX
// uses — keeping bars aligned with these variable-width columns.
export function buildMonthColumns(start: Date, end: Date): MonthGroup[] {
  const days: { date: Date }[] = []
  const cursor = startOfDay(start)
  const last = startOfDay(end)
  while (cursor <= last) {
    days.push({ date: new Date(cursor) })
    cursor.setDate(cursor.getDate() + 1)
  }
  return buildMonthGroups(days)
}
