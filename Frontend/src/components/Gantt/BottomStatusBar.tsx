import { StatusSquare } from './GanttRow'
import { STATUS_LABELS, type TaskStatus } from './status'

const LEGEND_ORDER: TaskStatus[] = ['complete', 'inWork', 'planned', 'blocked', 'overdue']
const MAX_VISIBLE_AVATARS = 4

type BottomStatusBarProps = {
  totalTasks: number
  completedPercent: number
  teamInitials: string[]
  statusCounts: Record<TaskStatus, number>
}

export function BottomStatusBar({ totalTasks, completedPercent, teamInitials, statusCounts }: BottomStatusBarProps) {
  const visibleInitials = teamInitials.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = teamInitials.length - visibleInitials.length

  return (
    <div className="flex h-[52px] shrink-0 items-center justify-between border-t border-[#e2e8f0] bg-white px-6">
      <div className="flex items-center gap-6 text-[12px]">
        <p className="text-[#475569]">
          Всего задач: <span className="font-semibold text-[#0f172a]">{totalTasks} задач</span>
        </p>
        <p className="text-[#475569]">
          Завершено: <span className="font-semibold text-[#0f172a]">{completedPercent}%</span>
        </p>
        <div className="flex items-center gap-2">
          <p className="text-[#475569]">Команда проекта:</p>
          <div className="flex items-center">
            {visibleInitials.map((initials, index) => (
              <div
                key={index}
                className="flex size-5 items-center justify-center rounded-[5px] border-2 border-white bg-[#d89425] text-[9px] font-medium text-white"
                style={{ marginLeft: index === 0 ? 0 : -6 }}
              >
                {initials}
              </div>
            ))}
            {overflowCount > 0 && (
              <div
                className="flex size-5 items-center justify-center rounded-[5px] border-2 border-white bg-[#e2e8f0] text-[9px] font-medium text-[#475569]"
                style={{ marginLeft: -6 }}
              >
                +{overflowCount}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {LEGEND_ORDER.map((status) => (
          <div key={status} className="flex items-center gap-1">
            <StatusSquare status={status} />
            <p className="text-[12px] text-[#1a1a1a]">
              {STATUS_LABELS[status]} ({statusCounts[status]})
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
