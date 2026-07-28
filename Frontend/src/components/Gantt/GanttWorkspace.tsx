import { useEffect, useRef } from 'react'
import {
  buildDayColumns,
  buildMonthGroups,
  buildWeekColumns,
  columnWidth,
  dateToX,
  xToDate,
  type DayColumn,
} from './dateGrid'
import { DENSITY_METRICS } from './densityMetrics'
import { flattenVisible } from './buildTaskTree'
import { GanttRowBar, GanttRowLeft, GanttRowTimelineBackground, rowHeightOf } from './GanttRow'
import { deriveStatus } from './status'
import type { GanttDensity, GanttTaskNode } from './types'

type TimelineScale = 'day' | 'week'

const LEFT_PANE_WIDTH = 710
const MONTH_ROW_HEIGHT = 24
const INITIAL_DATE_STORAGE_KEY = 'gantt-initial-date'

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
  onEditTask: (uid: number) => void
  onFinishChange: (uid: number, isoDate: string) => void
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
  onEditTask,
  onFinishChange,
}: GanttWorkspaceProps) {
  const metrics = DENSITY_METRICS[density]
  const visible = flattenVisible(roots, collapsed)
  const width = columnWidth(scale)

  const columns =
    scale === 'day' ? buildDayColumns(rangeStart, rangeEnd, today) : buildWeekColumns(rangeStart, rangeEnd)
  const timelineWidth = columns.length * width
  const monthGroups = scale === 'day' ? buildMonthGroups(columns as DayColumn[]) : []
  const monthRowHeight = scale === 'day' ? MONTH_ROW_HEIGHT : 0
  const showTodayLine = today >= rangeStart && today <= rangeEnd
  // Center the line in whichever day/week column contains today, rather
  // than sitting on its left edge.
  const todayColumnStart = Math.floor(dateToX(today, rangeStart, scale) / width) * width
  const todayLineX = todayColumnStart + width / 2

  const rowTops: number[] = []
  {
    let cursor = 0
    for (const node of visible) {
      rowTops.push(cursor)
      cursor += rowHeightOf(node, density)
    }
  }

  const childrenByUid = new Map<number, GanttTaskNode[]>()
  const collectChildren = (nodes: GanttTaskNode[]) => {
    for (const node of nodes) {
      childrenByUid.set(node.uid, node.children)
      collectChildren(node.children)
    }
  }
  collectChildren(roots)

  const scrollRef = useRef<HTMLDivElement>(null)
  // Kept fresh on every render so the unmount cleanup below (registered
  // once, at mount) reads the scale/rangeStart in effect when the user
  // actually navigates away, not whatever they were when the page opened.
  const latest = useRef({ scale, rangeStart })
  latest.current = { scale, rangeStart }
  // By the time an unmount cleanup runs, the element may already be
  // detached — a detached element's scrollLeft always reads back as 0. A
  // scroll listener keeps this ref current while it's still attached, so
  // the cleanup has a real value to save instead of a false 0.
  const lastScrollLeft = useRef(0)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const saved = localStorage.getItem(INITIAL_DATE_STORAGE_KEY)
    if (saved) {
      const savedDate = new Date(saved)
      if (!Number.isNaN(savedDate.getTime())) {
        container.scrollLeft = dateToX(savedDate, latest.current.rangeStart, latest.current.scale)
      }
    }
    lastScrollLeft.current = container.scrollLeft

    const handleScroll = () => {
      lastScrollLeft.current = container.scrollLeft
    }
    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      const { scale: currentScale, rangeStart: currentRangeStart } = latest.current
      const visibleDate = xToDate(lastScrollLeft.current, currentRangeStart, currentScale)
      localStorage.setItem(INITIAL_DATE_STORAGE_KEY, visibleDate.toISOString())
    }
  }, [])

  return (
    <div ref={scrollRef} className="flex min-h-0 flex-1 overflow-auto bg-white">
      <div className="flex" style={{ width: LEFT_PANE_WIDTH + timelineWidth }}>
        {/* LEFT PANE: sticky so it stays put while the right pane scrolls
            horizontally. z-40 keeps it above every right-pane layer
            (backgrounds/gridlines/today-line/bars top out at z-30), so
            scrolled-under bars never paint over the frozen columns. */}
        <div className="sticky left-0 z-40 flex shrink-0 flex-col bg-white" style={{ width: LEFT_PANE_WIDTH }}>
          <div className="sticky top-0 z-10 flex shrink-0 flex-col border-b border-[#e2e8f0] bg-white">
            {monthRowHeight > 0 && <div className="shrink-0" style={{ height: monthRowHeight }} />}
            <div
              className="flex shrink-0 items-center gap-3 px-4 text-[12px] font-semibold text-[#94a3b8]"
              style={{ height: metrics.headerHeight }}
            >
              <p className="min-w-0 flex-1">Задача</p>
              <p className="w-[120px] shrink-0">Исполнители</p>
              <p className="w-[60px] shrink-0 text-center">Оценка</p>
              <p className="w-[60px] shrink-0 text-center">Начало</p>
              <p className="w-[70px] shrink-0 text-center">Окончание</p>
            </div>
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
              onEdit={() => onEditTask(node.uid)}
              onFinishChange={(isoDate) => onFinishChange(node.uid, isoDate)}
            />
          ))}
        </div>

        {/* RIGHT PANE: timeline grid, bars, today-line */}
        <div className="relative flex-1 shrink-0" style={{ width: timelineWidth }}>
          <div className="sticky top-0 z-10 flex shrink-0 flex-col border-b border-[#e2e8f0] bg-white">
            {monthGroups.length > 0 && (
              <div className="flex shrink-0 border-b border-[#e2e8f0]" style={{ height: monthRowHeight }}>
                {monthGroups.map((group) => (
                  <div
                    key={group.startIndex}
                    className="flex shrink-0 items-center border-l border-[#e2e8f0] px-2 text-[11px] font-semibold text-[#475569] first:border-l-0"
                    style={{ width: group.days * width }}
                  >
                    {group.label}
                  </div>
                ))}
              </div>
            )}
            <div className="flex shrink-0" style={{ height: metrics.headerHeight }}>
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
          </div>

          <div className="relative">
            {/* Layer 1: group/stage row backgrounds — normal flow, defines
                the stack's total height for layers 2-4 below. */}
            <div className="relative z-0">
              {visible.map((node) => (
                <GanttRowTimelineBackground key={node.uid} node={node} density={density} />
              ))}
            </div>

            {/* Layer 2: day/week gridlines, with month boundaries emphasized */}
            <div className="absolute inset-0 z-10">
              {columns.map((_, index) => (
                <div key={index} className="absolute inset-y-0 w-px bg-[#f1f5f9]" style={{ left: index * width }} />
              ))}
              {monthGroups
                .filter((group) => group.startIndex > 0)
                .map((group) => (
                  <div
                    key={group.startIndex}
                    className="absolute inset-y-0 w-px bg-[#cbd5e1]"
                    style={{ left: group.startIndex * width }}
                  />
                ))}
            </div>

            {/* Layer 3: today line — dashed, centered in its column */}
            {showTodayLine && (
              <div
                className="absolute inset-y-0 z-20"
                style={{ left: todayLineX, borderLeft: '1.5px dashed #ef4444' }}
              />
            )}

            {/* Layer 4: task/group bars, on top of everything */}
            <div className="absolute inset-0 z-30">
              {visible.map((node, index) => (
                <GanttRowBar
                  key={node.uid}
                  node={node}
                  density={density}
                  scale={scale}
                  rangeStart={rangeStart}
                  status={deriveStatus(node, today)}
                  top={rowTops[index]}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
