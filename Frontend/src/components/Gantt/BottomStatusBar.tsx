import { StatusSquare } from './GanttRow'
import { STATUS_LABELS, type TaskStatus } from './status'

const LEGEND_ORDER: TaskStatus[] = ['complete', 'inWork', 'planned', 'blocked', 'overdue']
const MAX_VISIBLE_AVATARS = 4

type BottomStatusBarProps = {
  totalTasks: number
  completedPercent: number
  teamInitials: string[]
  statusCounts: Record<TaskStatus, number>
  activeStatuses: ReadonlySet<TaskStatus>
  onToggleStatus: (status: TaskStatus) => void
}

export function BottomStatusBar({
  totalTasks,
  completedPercent,
  teamInitials,
  statusCounts,
  activeStatuses,
  onToggleStatus,
}: BottomStatusBarProps) {
  const visibleInitials = teamInitials.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = teamInitials.length - visibleInitials.length
  const hasActiveFilter = activeStatuses.size > 0

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-6 border-t border-[#e2e8f0] bg-white px-6 text-[12px] dark:border-[#27272a] dark:bg-[#1a1a1a]">
      <p className="shrink-0 text-[#475569] dark:text-[#80808c]">
        Всего задач: <span className="font-semibold text-[#0f172a] dark:text-[#f2f2f7]">{totalTasks} задач</span>
      </p>
      <div className="flex items-center gap-3">
        {LEGEND_ORDER.map((status) => {
          const isActive = activeStatuses.has(status)
          return (
            <button
              key={status}
              type="button"
              onClick={() => onToggleStatus(status)}
              className={`flex items-center gap-1 rounded-full px-2 py-[3px] transition-opacity ${
                isActive ? 'bg-[#f1f5f9] dark:bg-[#1c1c1e]' : hasActiveFilter ? 'opacity-50' : ''
              }`}
            >
              <StatusSquare status={status} />
              <span className="text-[12px] text-[#1a1a1a] dark:text-[#f2f2f7]">
                {STATUS_LABELS[status]} ({statusCounts[status]})
              </span>
            </button>
          )
        })}
      </div>
      <p className="shrink-0 text-[#475569] dark:text-[#80808c]">
        Завершено: <span className="font-semibold text-[#0f172a] dark:text-[#f2f2f7]">{completedPercent}%</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <p className="text-[#475569] dark:text-[#80808c]">Команда проекта:</p>
        <div className="flex items-center">
          {visibleInitials.map((initials, index) => (
            <div
              key={index}
              className="flex size-5 items-center justify-center rounded-[5px] border-2 border-white bg-[#d89425] text-[9px] font-medium text-white dark:border-[#111111]"
              style={{ marginLeft: index === 0 ? 0 : -6 }}
            >
              {initials}
            </div>
          ))}
          {overflowCount > 0 && (
            <div
              className="flex size-5 items-center justify-center rounded-[5px] border-2 border-white bg-[#e2e8f0] text-[9px] font-medium text-[#475569] dark:border-[#111111] dark:bg-[#27272a] dark:text-[#80808c]"
              style={{ marginLeft: -6 }}
            >
              +{overflowCount}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
