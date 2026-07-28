import { buildDayColumns, buildWeekColumns, columnWidth, dateToX } from './dateGrid'
import { DENSITY_METRICS } from './densityMetrics'
import { flattenVisible } from './buildTaskTree'
import { GanttRowLeft, GanttRowTimeline } from './GanttRow'
import { deriveStatus } from './status'
import type { GanttDensity, GanttTaskNode } from './types'

type TimelineScale = 'day' | 'week'

const LEFT_PANE_WIDTH = 710

type GanttWorkspaceProps = {
  roots: GanttTaskNode[]
  scale: TimelineScale
  density: GanttDensity
  collapsed: ReadonlySet<number>
  onToggleCollapse: (uid: number) => void
  rangeStart: Date
  rangeEnd: Date
  today: Date
  assigneesByTaskUid: Map<number, string>
}

export function GanttWorkspace({
  roots,
  scale,
  density,
  collapsed,
  onToggleCollapse,
  rangeStart,
  rangeEnd,
  today,
  assigneesByTaskUid,
}: GanttWorkspaceProps) {
  const metrics = DENSITY_METRICS[density]
  const visible = flattenVisible(roots, collapsed)
  const width = columnWidth(scale)

  const columns =
    scale === 'day' ? buildDayColumns(rangeStart, rangeEnd, today) : buildWeekColumns(rangeStart, rangeEnd)
  const timelineWidth = columns.length * width
  const todayX = dateToX(today, rangeStart, scale)
  const showTodayLine = today >= rangeStart && today <= rangeEnd

  const childrenByUid = new Map<number, GanttTaskNode[]>()
  const collectChildren = (nodes: GanttTaskNode[]) => {
    for (const node of nodes) {
      childrenByUid.set(node.uid, node.children)
      collectChildren(node.children)
    }
  }
  collectChildren(roots)

  return (
    <div className="flex min-h-0 flex-1 overflow-auto bg-white">
      <div className="flex" style={{ width: LEFT_PANE_WIDTH + timelineWidth }}>
        {/* LEFT PANE: sticky so it stays put while the right pane scrolls horizontally */}
        <div className="sticky left-0 z-20 flex shrink-0 flex-col bg-white" style={{ width: LEFT_PANE_WIDTH }}>
          <div
            className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-[#e2e8f0] bg-white px-4 text-[12px] font-semibold text-[#94a3b8]"
            style={{ height: metrics.headerHeight }}
          >
            <p className="min-w-0 flex-1">Задача</p>
            <p className="w-[120px] shrink-0">Исполнители</p>
            <p className="w-[60px] shrink-0 text-center">Оценка</p>
            <p className="w-[60px] shrink-0 text-center">Начало</p>
            <p className="w-[70px] shrink-0 text-center">Окончание</p>
          </div>
          {visible.map((node) => (
            <GanttRowLeft
              key={node.uid}
              node={node}
              density={density}
              collapsed={collapsed.has(node.uid)}
              hasChildren={(childrenByUid.get(node.uid) ?? []).length > 0}
              onToggle={() => onToggleCollapse(node.uid)}
              status={deriveStatus(node, today)}
              assigneeNames={assigneesByTaskUid.get(node.uid) ?? ''}
            />
          ))}
        </div>

        {/* RIGHT PANE: timeline grid, bars, today-line */}
        <div className="relative flex-1 shrink-0" style={{ width: timelineWidth }}>
          <div
            className="sticky top-0 z-10 flex shrink-0 border-b border-[#e2e8f0] bg-white"
            style={{ height: metrics.headerHeight }}
          >
            {columns.map((column, index) => {
              const isToday = scale === 'day' && 'isToday' in column && column.isToday
              return (
                <div
                  key={index}
                  className="flex shrink-0 items-end justify-center pb-1 text-[11px] font-medium"
                  style={{ width, color: isToday ? '#ef4444' : '#94a3b8', fontWeight: isToday ? 700 : 500 }}
                >
                  {column.label}
                </div>
              )
            })}
          </div>

          <div className="relative">
            {columns.map((_, index) => (
              <div
                key={index}
                className="absolute inset-y-0 w-px bg-[#f1f5f9]"
                style={{ left: index * width }}
              />
            ))}
            {showTodayLine && <div className="absolute inset-y-0 w-[1.5px] bg-[#ef4444]" style={{ left: todayX }} />}
            {visible.map((node) => (
              <GanttRowTimeline
                key={node.uid}
                node={node}
                density={density}
                scale={scale}
                rangeStart={rangeStart}
                status={deriveStatus(node, today)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
