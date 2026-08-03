import { SegmentedControl, SegmentedOption } from '../ui/SegmentedControl'

// Matches the synthetic dataset's fixed span (see Backend's
// internal/timesheet.RangeStart/RangeEnd) — this is a stage-1 PoC dataset,
// not derived from any real data source, so the picker's range is hardcoded
// to match it rather than fetched.
export const TIMESHEET_RANGE_START = { year: 2025, month: 8 }
export const TIMESHEET_RANGE_END = { year: 2026, month: 7 }

const MONTH_LABELS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

type MonthOption = { year: number; month: number }

function buildMonthOptions(): MonthOption[] {
  const options: MonthOption[] = []
  let { year, month } = TIMESHEET_RANGE_START
  while (year < TIMESHEET_RANGE_END.year || (year === TIMESHEET_RANGE_END.year && month <= TIMESHEET_RANGE_END.month)) {
    options.push({ year, month })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return options
}

const MONTH_OPTIONS = buildMonthOptions()

type MonthPickerProps = {
  value: MonthOption
  onChange: (value: MonthOption) => void
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  return (
    <SegmentedControl>
      {MONTH_OPTIONS.map((option, index) => {
        const isNewYear = index === 0 || option.year !== MONTH_OPTIONS[index - 1].year
        const isActive = option.year === value.year && option.month === value.month
        return (
          <div key={`${option.year}-${option.month}`} className="flex items-center">
            {isNewYear && (
              <p className="whitespace-nowrap py-[5px] pl-[6px] pr-1 text-[11px] font-bold text-[var(--text-primary)]">
                {option.year}
              </p>
            )}
            <SegmentedOption
              active={isActive}
              onClick={() => onChange(option)}
              className="px-2 py-[5px] text-[11px]"
              inactiveClassName="font-medium text-[#475569] dark:text-[#666e7a]"
            >
              {MONTH_LABELS[option.month - 1]}
            </SegmentedOption>
          </div>
        )
      })}
    </SegmentedControl>
  )
}
