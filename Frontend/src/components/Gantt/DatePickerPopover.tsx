import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

// yyyy-mm-dd in the date's own local fields — never toISOString(), which
// converts through UTC and can shift the date across a timezone boundary.
function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const totalDays = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const leadingBlanks = mondayIndex(viewMonth)
  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ]

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[100] w-[240px] rounded-lg border border-[#e2e8f0] bg-white p-3 shadow-lg"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="cursor-pointer rounded px-1.5 py-0.5 text-[13px] text-[#475569] hover:bg-[#f1f5f9]"
        >
          ‹
        </button>
        <p className="text-[13px] font-semibold text-[#0f172a]">
          {MONTH_NAMES_FULL[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="cursor-pointer rounded px-1.5 py-0.5 text-[13px] text-[#475569] hover:bg-[#f1f5f9]"
        >
          ›
        </button>
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
              className={`size-8 cursor-pointer rounded text-[12px] hover:bg-[#eef2ff] ${
                isSameDay(date, selected) ? 'bg-[#4078d9] font-semibold text-white hover:bg-[#4078d9]' : 'text-[#0f172a]'
              }`}
            >
              {date.getDate()}
            </button>
          ) : (
            <span key={index} />
          ),
        )}
      </div>
    </div>,
    document.body,
  )
}
