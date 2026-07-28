import chevronDownIcon from '../../assets/icons/chevron-down.svg'
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

type GanttRowLeftProps = {
  node: GanttTaskNode
  density: GanttDensity
  collapsed: boolean
  hasChildren: boolean
  onToggle: () => void
  status: TaskStatus
  assigneeNames: string
}

export function GanttRowLeft({
  node,
  density,
  collapsed,
  hasChildren,
  onToggle,
  status,
  assigneeNames,
}: GanttRowLeftProps) {
  const metrics = DENSITY_METRICS[density]

  if (node.isSummary) {
    const isStage = node.depth === 0
    return (
      <div
        className={`flex shrink-0 items-center border-b border-[#e2e8f0] pr-4 ${isStage ? 'bg-[#eef2ff]' : 'bg-[#f8fafc]'}`}
        style={{ height: metrics.groupRowHeight }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: 13 + node.depth * 20 }}>
          {hasChildren && <ChevronToggle collapsed={collapsed} onToggle={onToggle} />}
          <p className={`truncate text-[13px] text-[#374151] ${isStage ? 'font-bold' : 'font-semibold'}`}>
            {node.name}
          </p>
        </div>
        <p className="w-[60px] shrink-0 text-center text-[12px] text-[#475469]">{formatShortDate(node.start)}</p>
        <p className="w-[70px] shrink-0 text-center text-[12px] text-[#475469]">{formatShortDate(node.finish)}</p>
      </div>
    )
  }

  const effortDays = Math.round(node.durationHours / 8)

  return (
    <div
      className="flex shrink-0 items-center gap-3 border-b border-[#f1f5f9] bg-white pr-4"
      style={{ height: metrics.rowHeight }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: 16 + node.depth * 20 }}>
        <StatusSquare status={status} />
        <p className="truncate text-[13px] font-medium text-[#0f172a]">{node.name}</p>
      </div>
      <p className="w-[120px] shrink-0 truncate text-[12px] text-[#475569]">{assigneeNames}</p>
      <p className="w-[60px] shrink-0 text-center text-[12px] font-semibold text-[#475569]">
        {effortDays > 0 ? `${effortDays}д` : ''}
      </p>
      <p className="w-[60px] shrink-0 text-center text-[12px] text-[#475469]">{formatShortDate(node.start)}</p>
      <p className="w-[70px] shrink-0 text-center text-[12px] text-[#475469]">{formatShortDate(node.finish)}</p>
    </div>
  )
}

type GanttRowTimelineProps = {
  node: GanttTaskNode
  density: GanttDensity
  scale: GanttScale
  rangeStart: Date
  status: TaskStatus
}

export function GanttRowTimeline({ node, density, scale, rangeStart, status }: GanttRowTimelineProps) {
  const metrics = DENSITY_METRICS[density]
  const height = node.isSummary ? metrics.groupRowHeight : metrics.rowHeight
  const left = dateToX(new Date(node.start), rangeStart, scale)
  const width = node.isMilestone ? 0 : durationToWidth(new Date(node.start), new Date(node.finish), scale)

  const rowBg = node.isSummary ? (node.depth === 0 ? '#eef2ff' : '#f8fafc') : undefined

  return (
    <div className="relative shrink-0 border-b border-[#f1f5f9]" style={{ height, backgroundColor: rowBg }}>
      {node.isSummary ? (
        <div
          className="absolute top-1/2 rounded-[6px]"
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
          isMilestone={node.isMilestone}
        />
      )}
    </div>
  )
}
