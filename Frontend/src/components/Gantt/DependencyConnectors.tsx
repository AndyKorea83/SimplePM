import { useMemo } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { pxPerDay, taskBarSpan } from './dateGrid'
import { DENSITY_METRICS } from './densityMetrics'
import { rowHeightOf } from './GanttRow'
import type { GanttDensity, GanttScale, GanttTaskNode } from './types'

const ARROW_SIZE = 6
const MIN_EDGE_INSET_PX = 5

// Точка выхода — середина последнего (или первого, для НО/НН) дня задачи,
// а не сама граница бара, иначе линия визуально сливается с краем бара.
// На мелких масштабах (неделя/месяц) половина ширины дня меньше 5px, но
// отступ от границы должен быть заметен независимо от масштаба — поэтому
// нижняя граница в 5px.
function edgeInset(scale: GanttScale): number {
  return Math.max(pxPerDay(scale) / 2, MIN_EDGE_INSET_PX)
}

type BarSpan = { left: number; right: number; isPoint: boolean }

// Какой край бара — точка выхода из предшественника и точка входа в
// преемника — использовать для каждого из 4 типов связи (ОО/ОН/НО/НН).
// Точка выхода смещена внутрь бара на edgeInset — веха (единственная точка
// во времени, left===right) остаётся исключением: смещать её некуда.
function edgeFor(
  type: number,
  predSpan: BarSpan,
  succSpan: BarSpan,
  scale: GanttScale,
): { sourceX: number; targetX: number } {
  const inset = predSpan.isPoint ? 0 : edgeInset(scale)
  switch (type) {
    case 0: // Окончание -> Окончание
      return { sourceX: predSpan.right - inset, targetX: succSpan.right }
    case 2: // Начало -> Окончание
      return { sourceX: predSpan.left + inset, targetX: succSpan.right }
    case 3: // Начало -> Начало
      return { sourceX: predSpan.left + inset, targetX: succSpan.left }
    default: // 1, Окончание -> Начало — самый частый случай
      return { sourceX: predSpan.right - inset, targetX: succSpan.left }
  }
}

// Половина высоты самого бара (не строки) — групповой бар рисуется тонкой
// 4px-линией по центру строки (см. GanttRowBar), у обычной задачи высота
// берётся из density-метрик.
function barHalfHeight(node: GanttTaskNode, density: GanttDensity): number {
  return node.isSummary ? 2 : DENSITY_METRICS[density].barHeight / 2
}

// Ломаная "уголком": сначала вертикальный отрезок вниз/вверх строго по
// x предшественника (без горизонтальной заглушки — иначе при задачах
// впритык друг к другу заглушка "перелетает" через начало преемника, и
// стрелка влетает в него не с той стороны), затем горизонтальный подход
// к точке входа. marker-end сам разворачивается по направлению последнего
// сегмента (orient="auto").
function buildElbowPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  if (sourceY === targetY) return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
  return `M ${sourceX} ${sourceY} L ${sourceX} ${targetY} L ${targetX} ${targetY}`
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
      const predMidY = rowTops[predIndex] + rowHeightOf(predNode, density) / 2
      const succY = rowTops[index] + rowHeightOf(node, density) / 2
      // Точка выхода — нижний или верхний край САМОГО БАРА (не середина
      // строки), в сторону строки преемника: иначе линия визуально
      // начинается прямо на правой/левой границе бара, а не под/над ним.
      const predY = predMidY + (succY > predMidY ? 1 : -1) * barHalfHeight(predNode, density)
      const { sourceX, targetX } = edgeFor(dep.type, predSpan, succSpan, scale)

      paths.push({
        key: `${dep.predecessorUid}-${node.uid}-${dep.type}`,
        d: buildElbowPath(sourceX, predY, targetX, succY),
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
