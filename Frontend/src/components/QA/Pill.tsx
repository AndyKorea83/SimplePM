import type { ReactNode } from 'react'
import type { ColorPair } from './qaColors'

// Общая цветная плашка (критичность/важность/тема/метка) — переиспользуется
// Kanban-карточкой, таблицей отчёта и страницей метрик; не в components/ui/,
// т.к. специфична только разделу QA (см. architect.md: в ui/ выносится
// только то, что нужно ≥2 фичам).
export function Pill({ color, className, children }: { color: ColorPair; className?: string; children: ReactNode }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${className ?? ''}`}
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {children}
    </span>
  )
}
