import type { DragEvent } from 'react'
import { Pill } from './Pill'
import { themeColor, SEVERITY_COLORS, PRIORITY_COLORS, LABEL_COLORS } from './qaColors'
import { shortName } from './format'
import type { BugDTO } from './types'

type KanbanCardProps = {
  bug: BugDTO
  draggable: boolean
  onClick: () => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
}

export function KanbanCard({ bug, draggable, onClick, onDragStart }: KanbanCardProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className="flex w-full cursor-pointer flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-sm hover:border-[#d89425]"
    >
      <p className="text-[12px] font-bold text-[var(--text-primary)]">
        #{bug.uid} {bug.title}
      </p>
      <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
        <span>{shortName(bug.assigneeName)}</span>
        <span>•</span>
        <span>{bug.theme}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Pill color={themeColor(bug.theme)}>{bug.theme}</Pill>
        <Pill color={PRIORITY_COLORS[bug.priority] ?? PRIORITY_COLORS.Normal}>{bug.priority}</Pill>
        <Pill color={SEVERITY_COLORS[bug.severity] ?? SEVERITY_COLORS.minor}>{bug.severity}</Pill>
        {bug.isBlocked && <Pill color={LABEL_COLORS.blocked}>blocked</Pill>}
        {bug.isPaused && <Pill color={LABEL_COLORS.paused}>paused</Pill>}
      </div>
    </div>
  )
}
