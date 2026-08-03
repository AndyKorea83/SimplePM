import type { ReactNode } from 'react'

// Обёртка сегментированного контрола (переключатель масштаба/плотности
// Ганта, выбор месяца) — переиспользуется как с SegmentedOption (текстовые
// пункты), так и напрямую с произвольными детьми (DensitySwitcher —
// у него активное состояние только фон, без смены шрифта/цвета текста,
// поэтому он не подходит под SegmentedOption).
export function SegmentedControl({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-start gap-[2px] rounded-lg bg-[#ebedf2] p-[3px] dark:bg-[#1c1c1e]">{children}</div>
}

// Активный токен одинаков у всех текстовых пунктов (ScaleSelector,
// MonthPicker) — зашит. Неактивный цвет текста не зашит: у MonthPicker он
// хардкод (#475569/dark:#666e7a), ещё не переведённый на CSS-переменную
// var(--text-secondary), которую использует ScaleSelector — это разные
// значения в тёмной теме, не совпадение, поэтому не унифицируется здесь.
const ACTIVE_CLASS = 'bg-white font-semibold text-[var(--text-primary)] dark:bg-[#2a2a2e]'

type SegmentedOptionProps = {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  inactiveClassName?: string
}

export function SegmentedOption({
  active,
  onClick,
  children,
  className,
  inactiveClassName = 'font-medium text-[var(--text-secondary)]',
}: SegmentedOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer whitespace-nowrap rounded-md ${active ? ACTIVE_CLASS : inactiveClassName} ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
