import { useState, type DragEvent } from 'react'
import { KanbanCard } from './KanbanCard'
import type { KanbanColumnDTO } from './types'

type KanbanColumnProps = {
  column: KanbanColumnDTO
  acceptsDrop: boolean
  onCardClick: (uid: number) => void
  onDropBug: (bugUid: number) => void
}

// "Blocked & paused" — не обычная колонка по статусу (см. Backend
// usecase.ListKanban — баг туда попадает по флагу IsBlocked/IsPaused,
// независимо от Status), поэтому она не участвует в drag-and-drop ни как
// источник, ни как цель: перетаскивание меняет именно Status, а не флаги,
// так что карточка, "переброшенная" из этой колонки, тут же вернулась бы
// обратно после перезапроса. Разблокировка — отдельная задача на будущее.
export function KanbanColumn({ column, acceptsDrop, onCardClick, onDropBug }: KanbanColumnProps) {
  const [isOver, setIsOver] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        if (!acceptsDrop) return
        e.preventDefault()
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        if (!acceptsDrop) return
        e.preventDefault()
        setIsOver(false)
        const uid = Number(e.dataTransfer.getData('text/plain'))
        if (uid) onDropBug(uid)
      }}
      className={`flex h-full min-w-[220px] flex-1 flex-col gap-2 rounded-lg p-2 ${
        isOver ? 'bg-[#eef2ff] dark:bg-[#1c1c1e]' : ''
      }`}
    >
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-[13px] font-bold text-[var(--text-primary)]">{column.title}</p>
        <span className="rounded-[10px] bg-[#d1d5db] px-1.5 py-0.5 text-[11px] font-semibold text-[#0f172a]">
          {column.bugs.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {column.bugs.map((bug) => (
          <KanbanCard
            key={bug.uid}
            bug={bug}
            draggable={acceptsDrop}
            onClick={() => onCardClick(bug.uid)}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', String(bug.uid))}
          />
        ))}
      </div>
    </div>
  )
}
