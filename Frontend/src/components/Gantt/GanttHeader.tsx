import type { ReactNode } from 'react'
import calendarIcon from '../../assets/icons/calendar.svg'
import settingsIcon from '../../assets/icons/settings.svg'
import chevronDownIcon from '../../assets/icons/chevron-down.svg'
import type { GanttDensity, GanttScale } from './types'

const SCALE_OPTIONS: { key: GanttScale; label: string }[] = [
  { key: 'day', label: 'Дни' },
  { key: 'week', label: 'Недели' },
  { key: 'month', label: 'Месяцы' },
]

const DENSITY_OPTIONS: { key: GanttDensity; lines: number }[] = [
  { key: 'default', lines: 3 },
  { key: 'compact', lines: 4 },
  { key: 'dense', lines: 5 },
]

function SegmentedControl({ children }: { children: ReactNode }) {
  return <div className="bg-[#ebedf2] flex gap-[2px] items-start p-[3px] rounded-lg shrink-0">{children}</div>
}

function ScaleSelector({
  scale,
  onChange,
}: {
  scale: GanttScale
  onChange: (scale: GanttScale) => void
}) {
  return (
    <SegmentedControl>
      {SCALE_OPTIONS.map((option) => {
        const isActive = option.key === scale
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`cursor-pointer whitespace-nowrap rounded-md px-3 py-[6px] text-[12px] ${
              isActive ? 'bg-white font-semibold text-[#0f172a]' : 'font-medium text-[#475569]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </SegmentedControl>
  )
}

function DensitySwitcher({
  density,
  onChange,
}: {
  density: GanttDensity
  onChange: (density: GanttDensity) => void
}) {
  return (
    <SegmentedControl>
      {DENSITY_OPTIONS.map((option) => {
        const isActive = option.key === density
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-label={option.key}
            className={`flex h-[27px] w-8 cursor-pointer flex-col items-center justify-center gap-[2px] rounded-md ${
              isActive ? 'bg-white' : ''
            }`}
          >
            {Array.from({ length: option.lines }).map((_, i) => (
              <span
                key={i}
                className={`block h-[1.5px] w-[14px] rounded-[1px] ${isActive ? 'bg-[#0f172a]' : 'bg-[#80858f]'}`}
              />
            ))}
          </button>
        )
      })}
    </SegmentedControl>
  )
}

type TeamMember = { uid: number; name: string }

function AssigneeFilter({
  teamMembers,
  value,
  onChange,
}: {
  teamMembers: TeamMember[]
  value: number | null
  onChange: (uid: number | null) => void
}) {
  return (
    <select
      value={value ?? 'all'}
      onChange={(event) => onChange(event.target.value === 'all' ? null : Number(event.target.value))}
      className="cursor-pointer rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] font-medium text-[#0f172a]"
    >
      <option value="all">Все исполнители</option>
      {teamMembers.map((member) => (
        <option key={member.uid} value={member.uid}>
          {member.name}
        </option>
      ))}
    </select>
  )
}

type GanttHeaderProps = {
  title: string
  dateRangeLabel: string
  scale: GanttScale
  onScaleChange: (scale: GanttScale) => void
  density: GanttDensity
  onDensityChange: (density: GanttDensity) => void
  teamMembers: TeamMember[]
  assigneeFilter: number | null
  onAssigneeFilterChange: (uid: number | null) => void
  onAddTask: () => void
}

export function GanttHeader({
  title,
  dateRangeLabel,
  scale,
  onScaleChange,
  density,
  onDensityChange,
  teamMembers,
  assigneeFilter,
  onAssigneeFilterChange,
  onAddTask,
}: GanttHeaderProps) {
  return (
    <div className="flex h-[61px] shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-white px-4">
      <div className="flex items-center gap-[6px]">
        <p className="text-[18px] font-bold text-[#0f172a]">{title}</p>
        <img src={chevronDownIcon} alt="" className="size-4" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2">
          <img src={calendarIcon} alt="" style={{ width: 14, height: 14 }} />
          <p className="text-[13px] font-medium text-[#0f172a]">{dateRangeLabel}</p>
        </div>
        <AssigneeFilter teamMembers={teamMembers} value={assigneeFilter} onChange={onAssigneeFilterChange} />
        <ScaleSelector scale={scale} onChange={onScaleChange} />
        <DensitySwitcher density={density} onChange={onDensityChange} />
        <div className="flex items-center gap-[6px] rounded-lg border border-[#e2e8f0] bg-white px-3 py-2">
          <img src={settingsIcon} alt="" style={{ width: 14, height: 14 }} />
          <p className="text-[13px] font-medium text-[#475569]">Настройки</p>
        </div>
        <button
          type="button"
          onClick={onAddTask}
          className="cursor-pointer rounded-lg bg-[#4078d9] px-3 py-2 text-[13px] font-medium text-white"
        >
          + Задача
        </button>
      </div>
    </div>
  )
}
