import { useState } from 'react'
import { Button } from '../ui/Button'
import { Popover } from '../ui/Popover'
import { toDateInputValue } from './dateGrid'

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const MONTH_NAMES_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Monday-first weekday index (0 = Monday .. 6 = Sunday).
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

type DatePickerPopoverProps = {
  value: string
  anchorRect: DOMRect
  onChange: (isoDate: string) => void
  onClose: () => void
}

export function DatePickerPopover({ value, anchorRect, onChange, onClose }: DatePickerPopoverProps) {
  const selected = new Date(value)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected))

  const totalDays = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const leadingBlanks = mondayIndex(viewMonth)
  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ]

  return (
    <Popover anchorRect={anchorRect} onClose={onClose} className="w-[240px] p-3">
      <div className="mb-2 flex items-center justify-between">
        <Button
          variant="ghost"
          className="px-1.5 py-0.5 text-[13px]"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        >
          ‹
        </Button>
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">
          {MONTH_NAMES_FULL[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </p>
        <Button
          variant="ghost"
          className="px-1.5 py-0.5 text-[13px]"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        >
          ›
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-[#94a3b8]">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((date, index) =>
          date ? (
            <button
              key={index}
              type="button"
              onClick={() => {
                onChange(toDateInputValue(date))
                onClose()
              }}
              className={`size-8 cursor-pointer rounded text-[12px] hover:bg-[#eef2ff] dark:hover:bg-[#27272a] ${
                isSameDay(date, selected)
                  ? 'bg-[#4078d9] font-semibold text-white hover:bg-[#4078d9] dark:hover:bg-[#4078d9]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {date.getDate()}
            </button>
          ) : (
            <span key={index} />
          ),
        )}
      </div>
    </Popover>
  )
}
