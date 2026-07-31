import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type PredecessorOption = { uid: number; label: string }

type PredecessorPickerProps = {
  options: PredecessorOption[]
  anchorRect: DOMRect
  onSelect: (uid: number) => void
  onClose: () => void
}

export function PredecessorPicker({ options, anchorRect, onSelect, onClose }: PredecessorPickerProps) {
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
      className="fixed z-[100] max-h-[280px] w-[260px] overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white p-2 shadow-lg dark:border-[#27272a] dark:bg-[#1c1c1e]"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
    >
      {options.length === 0 ? (
        <p className="px-2 py-1 text-[13px] text-[#94a3b8] dark:text-[#80808c]">Нет доступных задач</p>
      ) : (
        options.map((option) => (
          <button
            key={option.uid}
            type="button"
            onClick={() => {
              onSelect(option.uid)
              onClose()
            }}
            className="block w-full cursor-pointer truncate rounded px-2 py-1.5 text-left text-[13px] text-[#0f172a] hover:bg-[#f1f5f9] dark:text-[#f2f2f7] dark:hover:bg-[#27272a]"
          >
            {option.label}
          </button>
        ))
      )}
    </div>,
    document.body,
  )
}
