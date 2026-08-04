import { MonthPicker as GenericMonthPicker, type MonthOption } from '../ui/MonthPicker'

// Matches the synthetic dataset's fixed span (see Backend's
// internal/timesheet.RangeStart/RangeEnd) — this is a stage-1 PoC dataset,
// not derived from any real data source, so the picker's range is hardcoded
// to match it rather than fetched.
export const TIMESHEET_RANGE_START: MonthOption = { year: 2025, month: 8 }
export const TIMESHEET_RANGE_END: MonthOption = { year: 2026, month: 7 }

type MonthPickerProps = {
  value: MonthOption
  onChange: (value: MonthOption) => void
}

// Тонкая обёртка над ui/MonthPicker (issue #59/#71: контрол вынесен туда по
// факту появления второго потребителя — QA-метрик) — сохраняет прежний API
// с зашитым диапазоном Календаря, чтобы CalendarPage/LaborCostsPage не менялись.
export function MonthPicker({ value, onChange }: MonthPickerProps) {
  return (
    <GenericMonthPicker value={value} onChange={onChange} rangeStart={TIMESHEET_RANGE_START} rangeEnd={TIMESHEET_RANGE_END} />
  )
}
