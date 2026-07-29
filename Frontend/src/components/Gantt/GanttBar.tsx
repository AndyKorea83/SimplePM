import { STATUS_COLORS, type TaskStatus } from './status'

const MIN_INSIDE_LABEL_WIDTH = 40

type GanttBarProps = {
  left: number
  width: number
  height: number
  percentComplete: number
  status: TaskStatus
  isMilestone: boolean
  onDoubleClick?: () => void
}

export function GanttBar({ left, width, height, percentComplete, status, isMilestone, onDoubleClick }: GanttBarProps) {
  const color = STATUS_COLORS[status]

  if (isMilestone) {
    const size = height * 0.7
    return (
      <div
        className="absolute top-1/2 cursor-pointer select-none rounded-[2px]"
        onDoubleClick={onDoubleClick}
        style={{
          left: left - size / 2,
          width: size,
          height: size,
          backgroundColor: status === 'planned' ? undefined : color,
          border: status === 'planned' ? `1.5px dashed ${color}` : undefined,
          transform: 'translateY(-50%) rotate(45deg)',
        }}
      />
    )
  }

  const fillWidth = Math.max(width * (percentComplete / 100), 0)
  const labelInside = fillWidth >= MIN_INSIDE_LABEL_WIDTH

  return (
    <div
      className="absolute top-1/2 cursor-pointer select-none"
      onDoubleClick={onDoubleClick}
      style={{ left, width, height, transform: 'translateY(-50%)' }}
    >
      <div
        className="absolute inset-0 rounded-[4px]"
        style={{ backgroundColor: color, opacity: 0.15 }}
      />
      {status === 'planned' ? (
        <div className="absolute inset-0 rounded-[4px] border border-dashed" style={{ borderColor: color }} />
      ) : (
        <div
          className="absolute inset-y-0 left-0 rounded-[4px]"
          style={{ width: fillWidth, backgroundColor: color }}
        />
      )}
      {labelInside ? (
        <p
          className="absolute inset-y-0 left-0 flex items-center justify-center text-[11px] font-medium text-white"
          style={{ width: fillWidth }}
        >
          {percentComplete}%
        </p>
      ) : (
        <p
          className="absolute top-1/2 whitespace-nowrap text-[11px] font-medium text-[#374151]"
          style={{ left: width + 6, transform: 'translateY(-50%)' }}
        >
          {percentComplete}%
        </p>
      )}
    </div>
  )
}
