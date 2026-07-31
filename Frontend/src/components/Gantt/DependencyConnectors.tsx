import { useMemo } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { taskBarSpan } from './dateGrid'
import { rowHeightOf } from './GanttRow'
import type { GanttDensity, GanttScale, GanttTaskNode } from './types'

const STUB_PX = 10
const ARROW_SIZE = 6

type BarSpan = { left: number; right: number; isPoint: boolean }

// Какой край бара — точка выхода из предшественника и точка входа в
// преемника — использовать для каждого из 4 типов связи (ОО/ОН/НО/НН).
// exitRight определяет, в какую сторону уходит первая заглушка линии.
function edgeFor(
  type: number,
  predSpan: BarSpan,
  succSpan: BarSpan,
): { sourceX: number; exitRight: boolean; targetX: number } {
  switch (type) {
    case 0: // Окончание -> Окончание
      return { sourceX: predSpan.right, exitRight: true, targetX: succSpan.right }
    case 2: // Начало -> Окончание
      return { sourceX: predSpan.left, exitRight: false, targetX: succSpan.right }
    case 3: // Начало -> Начало
      return { sourceX: predSpan.left, exitRight: false, targetX: succSpan.left }
    default: // 1, Окончание -> Начало — самый частый случай
      return { sourceX: predSpan.right, exitRight: true, targetX: succSpan.left }
  }
}

// Ломаная "уголком": заглушка от точки выхода наружу от бара, вертикальный
// переход к строке преемника, горизонтальный подход к точке входа.
// marker-end сам разворачивается по направлению последнего сегмента
// (orient="auto"), поэтому конкретная сторона входа здесь не важна.
function buildElbowPath(sourceX: number, sourceY: number, exitRight: boolean, targetX: number, targetY: number): string {
  const afterSourceX = sourceX + (exitRight ? STUB_PX : -STUB_PX)
  return `M ${sourceX} ${sourceY} L ${afterSourceX} ${sourceY} L ${afterSourceX} ${targetY} L ${targetX} ${targetY}`
}

type DependencyConnectorsProps = {
  visible: GanttTaskNode[]
  rowTops: number[]
  density: GanttDensity
  scale: GanttScale
  rangeStart: Date
}

export function DependencyConnectors({ visible, rowTops, density, scale, rangeStart }: DependencyConnectorsProps) {
  const { theme } = useTheme()
  // Контраст text-secondary (см. architect.md), а не приглушённый цвет
  // гридлайна — линию связи нужно видеть отчётливо на фоне сетки/баров.
  const strokeColor = theme === 'dark' ? '#94a3b8' : '#475569'

  const indexByUid = useMemo(() => {
    const map = new Map<number, number>()
    visible.forEach((node, index) => map.set(node.uid, index))
    return map
  }, [visible])

  const paths: { key: string; d: string }[] = []
  visible.forEach((node, index) => {
    for (const dep of node.dependencies ?? []) {
      const predIndex = indexByUid.get(dep.predecessorUid)
      // Предшественник свёрнут в группу или отфильтрован — связь просто не
      // рисуем, вместо маршрутизации через невидимую строку (см. issue #39).
      if (predIndex === undefined) continue

      const predNode = visible[predIndex]
      const predSpan = taskBarSpan(predNode, scale, rangeStart)
      const succSpan = taskBarSpan(node, scale, rangeStart)
      const predY = rowTops[predIndex] + rowHeightOf(predNode, density) / 2
      const succY = rowTops[index] + rowHeightOf(node, density) / 2
      const { sourceX, exitRight, targetX } = edgeFor(dep.type, predSpan, succSpan)

      paths.push({
        key: `${dep.predecessorUid}-${node.uid}-${dep.type}`,
        d: buildElbowPath(sourceX, predY, exitRight, targetX, succY),
      })
    }
  })

  if (paths.length === 0) return null

  return (
    <svg className="pointer-events-none absolute inset-0 z-[25]" width="100%" height="100%">
      <defs>
        <marker
          id="gantt-dependency-arrow"
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          refX={ARROW_SIZE - 1}
          refY={ARROW_SIZE / 2}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d={`M0,0 L${ARROW_SIZE},${ARROW_SIZE / 2} L0,${ARROW_SIZE} Z`} fill={strokeColor} />
        </marker>
      </defs>
      {paths.map((path) => (
        <path
          key={path.key}
          d={path.d}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          markerEnd="url(#gantt-dependency-arrow)"
        />
      ))}
    </svg>
  )
}
