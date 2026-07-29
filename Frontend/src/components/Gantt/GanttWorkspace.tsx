import { useEffect, useRef, useState } from 'react'
import {
  buildDayColumns,
  buildMonthColumns,
  buildMonthGroups,
  buildWeekColumns,
  columnWidth,
  dateToX,
  pxPerDay,
  xToDate,
} from './dateGrid'
import { DENSITY_METRICS } from './densityMetrics'
import { flattenVisible } from './buildTaskTree'
import { GanttRowBar, GanttRowLeft, GanttRowTimelineBackground, rowHeightOf } from './GanttRow'
import { deriveStatus } from './status'
import type { GanttDensity, GanttScale, GanttTaskNode } from './types'

const LEFT_PANE_WIDTH = 710
const MONTH_ROW_HEIGHT = 24
const INITIAL_DATE_STORAGE_KEY = 'gantt-initial-date'

// A uniform shape for one timeline column regardless of scale — day/week
// columns are all the same width, month columns aren't (months have
// different day counts), so header/gridlines/today-line render off this
// instead of a single shared `width`.
type RenderColumn = { key: number; x: number; width: number; label: string; isToday?: boolean }

function buildRenderColumns(scale: GanttScale, rangeStart: Date, rangeEnd: Date, today: Date): RenderColumn[] {
  if (scale === 'month') {
    const monthPxPerDay = pxPerDay(scale)
    return buildMonthColumns(rangeStart, rangeEnd).map((group) => ({
      key: group.startIndex,
      x: group.startIndex * monthPxPerDay,
      width: group.days * monthPxPerDay,
      label: group.label,
    }))
  }
  const width = columnWidth(scale)
  if (scale === 'day') {
    return buildDayColumns(rangeStart, rangeEnd, today).map((column, index) => ({
      key: index,
      x: index * width,
      width,
      label: column.label,
      isToday: column.isToday,
    }))
  }
  return buildWeekColumns(rangeStart, rangeEnd).map((column, index) => ({
    key: index,
    x: index * width,
    width,
    label: column.label,
  }))
}

type GanttWorkspaceProps = {
  roots: GanttTaskNode[]
  scale: GanttScale
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
  const [hoveredUid, setHoveredUid] = useState<number | null>(null)

  const columns = buildRenderColumns(scale, rangeStart, rangeEnd, today)
  const timelineWidth = columns.reduce((sum, column) => sum + column.width, 0)
  // Day and week scales get an extra header row grouping their columns by
  // calendar month; month scale's own columns already are months, so it has
  // no such super-header. The grouping is always computed from the day-level
  // range (calendar months don't depend on scale) and converted to pixels at
  // this scale's rate, so it lines up with day or week columns alike.
  const monthSuperGroups =
    scale === 'day' || scale === 'week' ? buildMonthGroups(buildDayColumns(rangeStart, rangeEnd, today)) : []
  const monthRowHeight = monthSuperGroups.length > 0 ? MONTH_ROW_HEIGHT : 0
  const showTodayLine = today >= rangeStart && today <= rangeEnd
  // Center the line in whichever column contains today, rather than sitting
  // on its left edge.
  const todayX = dateToX(today, rangeStart, scale)
  const todayColumn = [...columns].reverse().find((column) => todayX >= column.x)
  const todayLineX = todayColumn ? todayColumn.x + todayColumn.width / 2 : todayX

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
            horizontally. z-50 keeps it above every right-pane layer,
            including that pane's own sticky header (z-40), so scrolled-under
            bars/header cells never paint over the frozen columns. */}
        <div
          className="sticky left-0 z-50 flex shrink-0 flex-col border-r border-[#e2e8f0] bg-white"
          style={{ width: LEFT_PANE_WIDTH }}
        >
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
              isHovered={hoveredUid === node.uid}
              onHoverChange={(hovering) => setHoveredUid(hovering ? node.uid : null)}
            />
          ))}
        </div>

        {/* RIGHT PANE: timeline grid, bars, today-line */}
        <div className="relative flex-1 shrink-0" style={{ width: timelineWidth }}>
          {/* z-40: above every row layer below (backgrounds/gridlines/
              today-line/bars top out at z-30) so rows scrolling up never
              paint over the header's opaque background; still under the
              left pane's z-50 so it correctly hides under the frozen
              columns during horizontal scroll. */}
          <div className="sticky top-0 z-40 flex shrink-0 flex-col border-b border-[#e2e8f0] bg-white">
            {monthSuperGroups.length > 0 && (
              <div className="flex shrink-0 border-b border-[#e2e8f0]" style={{ height: monthRowHeight }}>
                {monthSuperGroups.map((group) => (
                  <div
                    key={group.startIndex}
                    className="flex shrink-0 items-center border-l border-[#e2e8f0] px-2 text-[11px] font-semibold text-[#475569] first:border-l-0"
                    style={{ width: group.days * pxPerDay(scale) }}
                  >
                    {group.label}
                  </div>
                ))}
              </div>
            )}
            <div className="flex shrink-0" style={{ height: metrics.headerHeight }}>
              {columns.map((column) => (
                <div
                  key={column.key}
                  className="flex shrink-0 items-end justify-center pb-1 text-[11px] font-medium"
                  style={{
                    width: column.width,
                    color: column.isToday ? '#ef4444' : '#94a3b8',
                    fontWeight: column.isToday ? 700 : 500,
                  }}
                >
                  {column.label}
                </div>
              ))}
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

            {/* Layer 2: column gridlines (day/week/month), with day/week
                scales' month boundaries emphasized */}
            <div className="absolute inset-0 z-10">
              {columns.map((column) => (
                <div key={column.key} className="absolute inset-y-0 w-px bg-[#f1f5f9]" style={{ left: column.x }} />
              ))}
              {monthSuperGroups
                .filter((group) => group.startIndex > 0)
                .map((group) => (
                  <div
                    key={group.startIndex}
                    className="absolute inset-y-0 w-px bg-[#cbd5e1]"
                    style={{ left: group.startIndex * pxPerDay(scale) }}
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
                  isHovered={hoveredUid === node.uid}
                  onHoverChange={(hovering) => setHoveredUid(hovering ? node.uid : null)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
