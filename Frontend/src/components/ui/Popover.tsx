import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type PopoverProps = {
  anchorRect: DOMRect
  onClose: () => void
  children: ReactNode
  // Только layout (ширина/паддинг/направление) — у трёх текущих попапов
  // это реально разное (календарная сетка/список/3-колоночный список),
  // цвет панели вызывающий не переопределяет (см. PANEL_SURFACE_CLASS).
  className?: string
}

// Единый визуальный стиль панели для всех попапов — цвета взяты из
// EmployeeSelector (Figma-верифицированы, issue #45, node 164:2864), а не
// из Gantt-попапов (там цвета были "приближены по аналогии", без спека).
const PANEL_SURFACE_CLASS =
  'rounded-lg border border-[#e0e3eb] bg-white shadow-lg dark:border-[#383d47] dark:bg-[#24262e]'

// z-[100] — выше слоя коннекторов Ганта (z-32) и sticky-хедеров (z-40/z-50).
export function Popover({ anchorRect, onClose, children, className }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
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

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed z-[100] ${PANEL_SURFACE_CLASS} ${className ?? ''}`}
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
    >
      {children}
    </div>,
    document.body,
  )
}
