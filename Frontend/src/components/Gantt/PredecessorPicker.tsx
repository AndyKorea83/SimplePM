import { Button } from '../ui/Button'
import { Popover } from '../ui/Popover'

type PredecessorOption = { uid: number; label: string }

type PredecessorPickerProps = {
  options: PredecessorOption[]
  anchorRect: DOMRect
  onSelect: (uid: number) => void
  onClose: () => void
}

export function PredecessorPicker({ options, anchorRect, onSelect, onClose }: PredecessorPickerProps) {
  return (
    <Popover anchorRect={anchorRect} onClose={onClose} className="max-h-[280px] w-[260px] overflow-y-auto p-2">
      {options.length === 0 ? (
        <p className="px-2 py-1 text-[13px] text-[var(--text-secondary)]">Нет доступных задач</p>
      ) : (
        options.map((option) => (
          <Button
            key={option.uid}
            variant="ghost"
            className="block w-full truncate px-2 py-1.5 text-left text-[13px] text-[var(--text-primary)]"
            onClick={() => {
              onSelect(option.uid)
              onClose()
            }}
          >
            {option.label}
          </Button>
        ))
      )}
    </Popover>
  )
}
