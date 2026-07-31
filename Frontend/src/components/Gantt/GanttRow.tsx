import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import chevronDownIcon from '../../assets/icons/chevron-down.svg'
import { DatePickerPopover } from './DatePickerPopover'
import { GanttBar } from './GanttBar'
import { DENSITY_METRICS } from './densityMetrics'
import { formatDayMonth, pxPerDay, taskBarSpan, toDateInputValue } from './dateGrid'
import { STATUS_COLORS, type TaskStatus } from './status'
import type { GanttDensity, GanttScale, GanttTaskNode } from './types'
import { useTheme } from '../../theme/ThemeContext'

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

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

function rowBaseColor(node: GanttTaskNode, isDark: boolean): string {
  if (!node.isSummary) return isDark ? '#111111' : '#ffffff'
  if (node.depth === 0) return isDark ? '#1e1e2e' : '#eef2ff'
  return isDark ? '#1a1a1a' : '#f8fafc'
}

function rowHoverColor(node: GanttTaskNode, isDark: boolean): string {
  if (!node.isSummary) return isDark ? '#1c1c1e' : '#f1f5f9'
  if (node.depth === 0) return isDark ? '#28243f' : '#e0e7ff'
  return isDark ? '#202024' : '#eef2ff'
}

function summaryRowBg(node: GanttTaskNode, isDark: boolean): string | undefined {
  if (!node.isSummary) return undefined
  return node.depth === 0 ? (isDark ? '#1e1e2e' : '#eef2ff') : isDark ? '#1a1a1a' : '#f8fafc'
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const rowColor = isHovered ? rowHoverColor(node, isDark) : rowBaseColor(node, isDark)

  if (node.isSummary) {
    const isStage = node.depth === 0
    return (
      <div
        className="flex shrink-0 items-center gap-3 border-b border-[#e2e8f0] pr-4 dark:border-[#27272a]"
        style={{ height: metrics.groupRowHeight, backgroundColor: rowColor }}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: 13 + node.depth * 20 }}>
          {hasChildren && <ChevronToggle collapsed={collapsed} onToggle={onToggle} />}
          <button
            type="button"
            onClick={onEdit}
            className={`cursor-pointer truncate text-left text-[13px] text-[#374151] hover:underline dark:text-[#f2f2f7] ${isStage ? 'font-bold' : 'font-semibold'}`}
          >
            {node.name}
          </button>
        </div>
        {/* Empty placeholders matching the "Исполнители"/"Оценка" columns —
            group rows don't show those, but need the same slots as leaf rows
            and the header so the start/finish columns line up exactly. */}
        <span className="w-[120px] shrink-0" />
        <span className="w-[60px] shrink-0" />
        <p className="w-[60px] shrink-0 text-center text-[12px] text-[#475469] dark:text-[#80808c]">
          {formatShortDate(node.start)}
        </p>
        <p className="w-[70px] shrink-0 text-center text-[12px] text-[#475469] dark:text-[#80808c]">
          {formatShortDate(node.finish)}
        </p>
      </div>
    )
  }

  const effortDays = Math.round(node.durationHours / 8)

  return (
    <div
      className="flex shrink-0 items-center gap-3 border-b border-[#f1f5f9] pr-4 dark:border-[#27272a]"
      style={{ height: metrics.rowHeight, backgroundColor: rowColor }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: 16 + node.depth * 20 }}>
        <StatusSquare status={status} />
        <button
          type="button"
          onClick={onEdit}
          className="cursor-pointer truncate text-left text-[13px] font-medium text-[#0f172a] hover:underline dark:text-[#f2f2f7]"
        >
          {node.name}
        </button>
      </div>
      <p className="w-[120px] shrink-0 truncate text-[12px] text-[#475569] dark:text-[#80808c]">{assigneeNames}</p>
      <p className="w-[60px] shrink-0 text-center text-[12px] font-semibold text-[#475569] dark:text-[#80808c]">
        {effortDays > 0 ? `${effortDays}д` : ''}
      </p>
      <EditableDateCell
        value={node.start}
        onChange={onStartChange}
        className="w-[60px] shrink-0 cursor-pointer text-center text-[12px] text-[#475469] hover:underline dark:text-[#80808c]"
      />
      <EditableDateCell
        value={node.finish}
        onChange={onFinishChange}
        className="w-[70px] shrink-0 cursor-pointer text-center text-[12px] text-[#475469] hover:underline dark:text-[#80808c]"
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
  const { theme } = useTheme()
  const rowBg = summaryRowBg(node, theme === 'dark')
  return (
    <div
      className="shrink-0 border-b border-[#f1f5f9] dark:border-[#27272a]"
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
  onStartChange: (isoDate: string) => void
  onFinishChange: (isoDate: string) => void
}

type EdgeDrag = { edge: 'start' | 'finish'; deltaDays: number }

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
  onStartChange,
  onFinishChange,
}: GanttRowBarProps) {
  const metrics = DENSITY_METRICS[density]
  const height = rowHeightOf(node, density)
  const [drag, setDrag] = useState<EdgeDrag | null>(null)

  // While dragging an edge, preview the bar at its dragged position/width —
  // the actual task dates only change once the drag ends (see beginDrag).
  const effectiveStart = drag?.edge === 'start' ? addDays(new Date(node.start), drag.deltaDays) : new Date(node.start)
  const effectiveFinish =
    drag?.edge === 'finish' ? addDays(new Date(node.finish), drag.deltaDays) : new Date(node.finish)

  const { left, right, isPoint: isPointInTime } = taskBarSpan(node, scale, rangeStart, effectiveStart, effectiveFinish)
  const width = right - left

  // Drags a bar's start or finish edge by whole days, following the mouse
  // horizontally; committed as a single onStartChange/onFinishChange call
  // when the mouse is released (not on every pixel of movement).
  const beginDrag = (edge: 'start' | 'finish') => (e: ReactMouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    let deltaDays = 0
    setDrag({ edge, deltaDays: 0 })

    const handleMove = (moveEvent: globalThis.MouseEvent) => {
      deltaDays = Math.round((moveEvent.clientX - startX) / pxPerDay(scale))
      setDrag({ edge, deltaDays })
    }
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      setDrag(null)
      if (deltaDays === 0) return
      const base = edge === 'start' ? node.start : node.finish
      const next = toDateInputValue(addDays(new Date(base), deltaDays))
      if (edge === 'start') onStartChange(next)
      else onFinishChange(next)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  return (
    <div
      className="absolute left-0 w-full"
      style={{ top, height, backgroundColor: isHovered ? 'rgba(37, 99, 235, 0.05)' : undefined }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {node.isSummary ? (
        // Один и тот же цвет независимо от глубины вложенности группы —
        // раньше depth 0 красился акцентным цветом, а вложенные группы
        // серым, и это выглядело как непоследовательность, а не как
        // осознанный уровень вложенности.
        <div
          className="absolute top-1/2 cursor-pointer rounded-[6px]"
          onDoubleClick={onEdit}
          style={{
            left,
            width: Math.max(width, 4),
            height: 4,
            transform: 'translateY(-50%)',
            backgroundColor: 'rgba(79,69,229,0.6)',
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
          onEdgeMouseDown={isPointInTime ? undefined : beginDrag}
        />
      )}
    </div>
  )
}
