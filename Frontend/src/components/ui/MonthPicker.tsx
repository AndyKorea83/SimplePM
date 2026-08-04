import { SegmentedControl, SegmentedOption } from './SegmentedControl'

// Вынесен из Calendar/MonthPicker.tsx (тот же приём, что ThemeToggle —
// issue #67/#71: перенос в ui/ по факту появления второго потребителя,
// не заранее). Диапазон теперь параметр, а не жёстко зашитая константа —
// у QA-метрик свой диапазон (internal/qa.RangeStart/RangeEnd), пусть пока
// численно и совпадающий с Календарём, это не повод их связывать.
const MONTH_LABELS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export type MonthOption = { year: number; month: number }

export function buildMonthOptions(rangeStart: MonthOption, rangeEnd: MonthOption): MonthOption[] {
  const options: MonthOption[] = []
  let { year, month } = rangeStart
  while (year < rangeEnd.year || (year === rangeEnd.year && month <= rangeEnd.month)) {
    options.push({ year, month })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return options
}

type MonthPickerProps = {
  value: MonthOption
  onChange: (value: MonthOption) => void
  rangeStart: MonthOption
  rangeEnd: MonthOption
}

export function MonthPicker({ value, onChange, rangeStart, rangeEnd }: MonthPickerProps) {
  const options = buildMonthOptions(rangeStart, rangeEnd)
  return (
    <SegmentedControl>
      {options.map((option, index) => {
        const isNewYear = index === 0 || option.year !== options[index - 1].year
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
