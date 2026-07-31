import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { pxPerDay, taskBarSpan } from './dateGrid'
import { DENSITY_METRICS } from './densityMetrics'
import { rowHeightOf } from './GanttRow'
import type { GanttDensity, GanttScale, GanttTaskNode } from './types'

const ARROW_SIZE = 6
const MIN_EDGE_INSET_PX = 5
// Ширина невидимого "хитбокса" под линией — сама линия всего 1.5px, кликнуть
// в неё точно неудобно, поэтому под ней рисуется прозрачная широкая копия.
const HIT_STROKE_WIDTH = 16
const DELETE_BUTTON_RADIUS = 8

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

type ConnectorPath = {
  key: string
  d: string
  successorUid: number
  predecessorUid: number
  type: number
  midX: number
  midY: number
}

type DragPreview = { sourceUid: number; startX: number; startY: number; currentX: number; currentY: number }

type DependencyConnectorsProps = {
  visible: GanttTaskNode[]
  rowTops: number[]
  density: GanttDensity
  scale: GanttScale
  rangeStart: Date
  onDeleteDependency: (successorUid: number, predecessorUid: number, type: number) => void
  dragPreview: DragPreview | null
}

export function DependencyConnectors({
  visible,
  rowTops,
  density,
  scale,
  rangeStart,
  onDeleteDependency,
  dragPreview,
}: DependencyConnectorsProps) {
  const { theme } = useTheme()
  // Контраст text-secondary (см. architect.md), а не приглушённый цвет
  // гридлайна — линию связи нужно видеть отчётливо на фоне сетки/баров.
  const strokeColor = theme === 'dark' ? '#94a3b8' : '#475569'
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // Место клика (в локальных координатах SVG) — кнопка удаления появляется
  // там, где реально кликнули, а не в середине линии (которая может быть
  // далеко от видимой части экрана при длинной связи через много строк).
  const [clickPoint, setClickPoint] = useState<{ x: number; y: number } | null>(null)
  const selectedGroupRef = useRef<SVGGElement>(null)

  const indexByUid = useMemo(() => {
    const map = new Map<number, number>()
    visible.forEach((node, index) => map.set(node.uid, index))
    return map
  }, [visible])

  const paths: ConnectorPath[] = []
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
        successorUid: node.uid,
        predecessorUid: dep.predecessorUid,
        type: dep.type,
        midX: sourceX,
        midY: (predY + succY) / 2,
      })
    }
  })

  const selected = paths.find((p) => p.key === selectedKey) ?? null

  // Клик вне выбранной линии/кнопки удаления — снять выделение; Escape — то
  // же самое; Delete/Backspace — удалить выбранную связь. Тот же паттерн
  // (document-листенеры, снимаются в cleanup), что и у попапов в проекте.
  useEffect(() => {
    if (!selected) return
    const handlePointerDown = (e: MouseEvent) => {
      if (selectedGroupRef.current && !selectedGroupRef.current.contains(e.target as Node)) {
        setSelectedKey(null)
        setClickPoint(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedKey(null)
        setClickPoint(null)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        onDeleteDependency(selected.successorUid, selected.predecessorUid, selected.type)
        setSelectedKey(null)
        setClickPoint(null)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selected, onDeleteDependency])

  if (paths.length === 0) return null

  return (
    <>
      {/* Видимый слой — под барами (z-25 < Layer 5's z-30), по правке
          пользователя. Целиком pointer-events: none. */}
      <svg className="absolute inset-0 z-[25]" width="100%" height="100%" style={{ pointerEvents: 'none' }}>
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

      {/* Интерактивный слой — ПОВЕРХ баров (z-[32] > Layer 5's z-30, но
          ниже sticky-хедеров z-40/z-50). Каждый ряд бара (GanttRowBar) —
          это div на всю ширину строки (w-full), а не только на ширину
          самого бара, и он лежит на z-30 — поэтому реальный клик мыши по
          линии связи на z-25 никогда бы до неё не долетел, до какого бы
          места по X ни попал. Хитбоксы и подсветка выбранной линии здесь
          рендерятся над этим слоем баров, чтобы клик реально доходил;
          сама линия при этом всё ещё физически видна из-под баров через
          нижний слой — тут рисуется только НЕВИДИМЫЙ хитбокс, а видимая
          подсветка появляется лишь для выбранной линии. */}
      <svg className="absolute inset-0 z-[32]" width="100%" height="100%" style={{ pointerEvents: 'none' }}>
        <defs>
          <marker
            id="gantt-dependency-arrow-selected"
            markerWidth={ARROW_SIZE}
            markerHeight={ARROW_SIZE}
            refX={ARROW_SIZE - 1}
            refY={ARROW_SIZE / 2}
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d={`M0,0 L${ARROW_SIZE},${ARROW_SIZE / 2} L0,${ARROW_SIZE} Z`} fill="#4078d9" />
          </marker>
        </defs>
        {paths.map((path) => (
          <path
            key={path.key}
            d={path.d}
            fill="none"
            stroke="transparent"
            strokeWidth={HIT_STROKE_WIDTH}
            role="button"
            aria-label={`Связь: задача ${path.predecessorUid} -> задача ${path.successorUid}`}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={(e) => {
              const svg = e.currentTarget.ownerSVGElement
              const ctm = svg?.getScreenCTM()
              if (svg && ctm) {
                const pt = svg.createSVGPoint()
                pt.x = e.clientX
                pt.y = e.clientY
                const local = pt.matrixTransform(ctm.inverse())
                setClickPoint({ x: local.x, y: local.y })
              }
              setSelectedKey(path.key)
            }}
          />
        ))}
        {selected && (
          <g ref={selectedGroupRef}>
            <path
              d={selected.d}
              fill="none"
              stroke="#4078d9"
              strokeWidth={2.5}
              markerEnd="url(#gantt-dependency-arrow-selected)"
              style={{ pointerEvents: 'none' }}
            />
            <circle
              cx={clickPoint?.x ?? selected.midX}
              cy={clickPoint?.y ?? selected.midY}
              r={DELETE_BUTTON_RADIUS}
              fill="#d93333"
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={() => {
                onDeleteDependency(selected.successorUid, selected.predecessorUid, selected.type)
                setSelectedKey(null)
                setClickPoint(null)
              }}
            />
            <path
              d={`M ${(clickPoint?.x ?? selected.midX) - 3} ${(clickPoint?.y ?? selected.midY) - 3} L ${(clickPoint?.x ?? selected.midX) + 3} ${(clickPoint?.y ?? selected.midY) + 3} M ${(clickPoint?.x ?? selected.midX) + 3} ${(clickPoint?.y ?? selected.midY) - 3} L ${(clickPoint?.x ?? selected.midX) - 3} ${(clickPoint?.y ?? selected.midY) + 3}`}
              stroke="white"
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        )}
        {/* Живое превью при перетаскивании ручки соединения — прямая
            пунктирная линия от места старта до текущей позиции курсора. */}
        {dragPreview && (
          <path
            d={`M ${dragPreview.startX} ${dragPreview.startY} L ${dragPreview.currentX} ${dragPreview.currentY}`}
            fill="none"
            stroke="#4078d9"
            strokeWidth={2}
            strokeDasharray="5 4"
            markerEnd="url(#gantt-dependency-arrow-selected)"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
    </>
  )
}
