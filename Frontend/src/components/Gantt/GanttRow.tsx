import { useRef, useState } from 'react'
import chevronDownIcon from '../../assets/icons/chevron-down.svg'
import { DatePickerPopover } from './DatePickerPopover'
import { GanttBar } from './GanttBar'
import { DENSITY_METRICS } from './densityMetrics'
import { dateToX, durationToWidth, formatDayMonth } from './dateGrid'
import { STATUS_COLORS, type TaskStatus } from './status'
import type { GanttDensity, GanttScale, GanttTaskNode } from './types'

export function StatusSquare({ status }: { status: TaskStatus }) {
  const color = STATUS_COLORS[status]
  if (status === 'planned') {
    return <span className="size-[10px] shrink-0 rounded-[2px] border border-dashed" style={{ borderColor: color }} />
  }
  return <span className="size-[10px] shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
}

function ChevronToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex size-4 shrink-0 cursor-pointer items-center justify-center"
    >
      <img
        src={chevronDownIcon}
        alt=""
        className="size-[14px]"
        style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }}
      />
    </button>
  )
}

function formatShortDate(iso: string): string {
  return formatDayMonth(new Date(iso))
}

// A date cell that displays like the read-only "Начало"/"Окончание" text
// but is clickable and opens a DatePickerPopover (portalled to <body>, so it
// isn't clipped by the table's scroll container) to pick a new date.
function EditableDateCell({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (isoDate: string) => void
  className: string
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setAnchor(buttonRef.current!.getBoundingClientRect())
        }}
        className={className}
      >
        {formatShortDate(value)}
      </button>
      {anchor && (
        <DatePickerPopover value={value} anchorRect={anchor} onChange={onChange} onClose={() => setAnchor(null)} />
      )}
    </>
  )
}

type GanttRowLeftProps = {
  node: GanttTaskNode
  density: GanttDensity
  collapsed: boolean
  hasChildren: boolean
  onToggle: () => void
  status: TaskStatus
  assigneeNames: string
  onEdit: () => void
  onStartChange: (isoDate: string) => void
  onFinishChange: (isoDate: string) => void
  isHovered: boolean
  onHoverChange: (hovering: boolean) => void
}

function rowBaseColor(node: GanttTaskNode): string {
  if (!node.isSummary) return '#ffffff'
  return node.depth === 0 ? '#eef2ff' : '#f8fafc'
}

function rowHoverColor(node: GanttTaskNode): string {
  if (!node.isSummary) return '#f1f5f9'
  return node.depth === 0 ? '#e0e7ff' : '#eef2ff'
}

export function GanttRowLeft({
  node,
  density,
  collapsed,
  hasChildren,
  onToggle,
  status,
  assigneeNames,
  onEdit,
  onStartChange,
  onFinishChange,
  isHovered,
  onHoverChange,
}: GanttRowLeftProps) {
  const metrics = DENSITY_METRICS[density]
  const rowColor = isHovered ? rowHoverColor(node) : rowBaseColor(node)

  if (node.isSummary) {
    const isStage = node.depth === 0
    return (
      <div
        className="flex shrink-0 items-center gap-3 border-b border-[#e2e8f0] pr-4"
        style={{ height: metrics.groupRowHeight, backgroundColor: rowColor }}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: 13 + node.depth * 20 }}>
          {hasChildren && <ChevronToggle collapsed={collapsed} onToggle={onToggle} />}
          <button
            type="button"
            onClick={onEdit}
            className={`cursor-pointer truncate text-left text-[13px] text-[#374151] hover:underline ${isStage ? 'font-bold' : 'font-semibold'}`}
          >
            {node.name}
          </button>
        </div>
        {/* Empty placeholders matching the "Исполнители"/"Оценка" columns —
            group rows don't show those, but need the same slots as leaf rows
            and the header so the start/finish columns line up exactly. */}
        <span className="w-[120px] shrink-0" />
        <span className="w-[60px] shrink-0" />
        <p className="w-[60px] shrink-0 text-center text-[12px] text-[#475469]">{formatShortDate(node.start)}</p>
        <p className="w-[70px] shrink-0 text-center text-[12px] text-[#475469]">{formatShortDate(node.finish)}</p>
      </div>
    )
  }

  const effortDays = Math.round(node.durationHours / 8)

  return (
    <div
      className="flex shrink-0 items-center gap-3 border-b border-[#f1f5f9] pr-4"
      style={{ height: metrics.rowHeight, backgroundColor: rowColor }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: 16 + node.depth * 20 }}>
        <StatusSquare status={status} />
        <button
          type="button"
          onClick={onEdit}
          className="cursor-pointer truncate text-left text-[13px] font-medium text-[#0f172a] hover:underline"
        >
          {node.name}
        </button>
      </div>
      <p className="w-[120px] shrink-0 truncate text-[12px] text-[#475569]">{assigneeNames}</p>
      <p className="w-[60px] shrink-0 text-center text-[12px] font-semibold text-[#475569]">
        {effortDays > 0 ? `${effortDays}д` : ''}
      </p>
      <EditableDateCell
        value={node.start}
        onChange={onStartChange}
        className="w-[60px] shrink-0 cursor-pointer text-center text-[12px] text-[#475469] hover:underline"
      />
      <EditableDateCell
        value={node.finish}
        onChange={onFinishChange}
        className="w-[70px] shrink-0 cursor-pointer text-center text-[12px] text-[#475469] hover:underline"
      />
    </div>
  )
}

export function rowHeightOf(node: GanttTaskNode, density: GanttDensity): number {
  const metrics = DENSITY_METRICS[density]
  return node.isSummary ? metrics.groupRowHeight : metrics.rowHeight
}

// Bottom layer: group/stage background band + row separator, in normal flow
// so the row stack's total height also defines the height of the gridline/
// today-line/bar overlay layers stacked on top of it.
export function GanttRowTimelineBackground({ node, density }: { node: GanttTaskNode; density: GanttDensity }) {
  const rowBg = node.isSummary ? (node.depth === 0 ? '#eef2ff' : '#f8fafc') : undefined
  return (
    <div
      className="shrink-0 border-b border-[#f1f5f9]"
      style={{ height: rowHeightOf(node, density), backgroundColor: rowBg }}
    />
  )
}

type GanttRowBarProps = {
  node: GanttTaskNode
  density: GanttDensity
  scale: GanttScale
  rangeStart: Date
  status: TaskStatus
  top: number
  isHovered: boolean
  onHoverChange: (hovering: boolean) => void
  onEdit: () => void
}

// Top layer: the task/group bar itself, absolutely positioned at this row's
// cumulative offset within the shared bar-overlay layer. This wrapper also
// sits above the background/gridline/today-line layers beneath it, so it's
// the only element on the timeline side that can receive this row's hover
// events — the highlight tint uses alpha so those lower layers still show
// through.
export function GanttRowBar({
  node,
  density,
  scale,
  rangeStart,
  status,
  top,
  isHovered,
  onHoverChange,
  onEdit,
}: GanttRowBarProps) {
  const metrics = DENSITY_METRICS[density]
  const height = rowHeightOf(node, density)
  const left = dateToX(new Date(node.start), rangeStart, scale)
  // A group/stage row spans its children's date range regardless of its own
  // isMilestone flag — some MSPDI exports (incl. our sample) set Milestone=1
  // on summary tasks too, which would otherwise collapse the aggregate bar
  // to a single point.
  const isPointInTime = node.isMilestone && !node.isSummary
  const width = isPointInTime ? 0 : durationToWidth(new Date(node.start), new Date(node.finish), scale)

  return (
    <div
      className="absolute left-0 w-full"
      style={{ top, height, backgroundColor: isHovered ? 'rgba(37, 99, 235, 0.05)' : undefined }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {node.isSummary ? (
        <div
          className="absolute top-1/2 cursor-pointer rounded-[6px]"
          onDoubleClick={onEdit}
          style={{
            left,
            width: Math.max(width, 4),
            height: 4,
            transform: 'translateY(-50%)',
            backgroundColor: node.depth === 0 ? 'rgba(79,69,229,0.6)' : '#94a3b8',
          }}
        />
      ) : (
        <GanttBar
          left={left}
          width={width}
          height={metrics.barHeight}
          percentComplete={node.percentComplete}
          status={status}
          isMilestone={isPointInTime}
          onDoubleClick={onEdit}
        />
      )}
    </div>
  )
}
