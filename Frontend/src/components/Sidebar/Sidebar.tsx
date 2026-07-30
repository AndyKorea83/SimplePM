import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { NAV_ROUTES, type NavKey } from '../../navigation'
import calendarIcon from '../../assets/icons/calendar.svg'
import barChartIcon from '../../assets/icons/bar-chart.svg'
import checkIcon from '../../assets/icons/check.svg'
import userIcon from '../../assets/icons/user.svg'
import bugIcon from '../../assets/icons/bug.svg'
import cpuIcon from '../../assets/icons/cpu.svg'
import clockCircleIcon from '../../assets/icons/clock-circle.svg'
import clockHourIcon from '../../assets/icons/clock-hour.svg'
import clockMinuteIcon from '../../assets/icons/clock-minute.svg'
import chevronRightIcon from '../../assets/icons/chevron-right.svg'
import collapseIcon from '../../assets/icons/collapse.svg'

type IconSpec = {
  src: string
  width: number
  height: number
  rotate?: number
}

function SimpleIcon({ src, width, height, rotate }: IconSpec) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center">
      <img src={src} alt="" style={{ width, height, transform: rotate ? `rotate(${rotate}deg)` : undefined }} />
    </span>
  )
}

// "Доска" — three bars, drawn directly (Figma has no image asset for these,
// just three colored rectangles).
function BoardIcon() {
  return (
    <span className="relative block size-5 shrink-0">
      <span className="absolute left-[4px] top-[5px] h-[10px] w-[3px] rounded-[1px] bg-[#888d9d]" />
      <span className="absolute left-[8.5px] top-[5px] h-[7px] w-[3px] rounded-[1px] bg-[#888d9d]" />
      <span className="absolute left-[13px] top-[5px] h-[12px] w-[3px] rounded-[1px] bg-[#888d9d]" />
    </span>
  )
}

// "Время" — a clock face assembled from its three exported parts (circle +
// hour/minute hands).
function ClockIcon() {
  return (
    <span className="relative block size-5 shrink-0">
      <img src={clockCircleIcon} alt="" className="absolute left-[3px] top-[3px] size-[14px]" />
      <img src={clockHourIcon} alt="" className="absolute left-[10px] top-[6px]" style={{ width: 1.2, height: 5.2 }} />
      <img
        src={clockMinuteIcon}
        alt=""
        className="absolute left-[10px] top-[10px]"
        style={{ width: 4.7, height: 1.2 }}
      />
    </span>
  )
}

// Natural pixel dimensions of each exported Figma icon — rendering them
// stretched to a uniform square distorts aspect ratio, so each keeps its own size.
const NAV_ICON_RENDERERS: Record<NavKey, () => ReactNode> = {
  board: () => <BoardIcon />,
  calendar: () => <ClockIcon />,
  gantt: () => <SimpleIcon src={barChartIcon} width={9.5} height={13.5} rotate={90} />,
  tasks: () => <SimpleIcon src={checkIcon} width={12.5} height={9} />,
  team: () => <SimpleIcon src={userIcon} width={11.5} height={12.5} />,
  qa: () => <SimpleIcon src={bugIcon} width={15.636} height={16} />,
  embedded: () => <SimpleIcon src={cpuIcon} width={16} height={16} />,
}

// Always mounted; width/opacity animate in lockstep with the sidebar's own width
// transition so labels never pop in/out ahead of the container (which caused the jump).
function Label({
  collapsed,
  className,
  children,
}: {
  collapsed: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={`overflow-hidden whitespace-nowrap leading-[16px] transition-[max-width,opacity] duration-200 ${
        collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'
      } ${className ?? ''}`}
    >
      {children}
    </span>
  )
}

type SidebarProps = {
  userInitials?: string
  userName?: string
}

const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed'

export function Sidebar({ userInitials = 'АК', userName = 'Алексей К.' }: SidebarProps) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_STORAGE_KEY) !== 'false',
  )

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <div
      className={`bg-white dark:bg-[#111111] h-screen flex flex-col items-start gap-4 py-4 px-[10px] shrink-0 overflow-hidden border-r border-[#e2e8f0] dark:border-r-0 transition-[width] duration-200 ${
        collapsed ? 'w-[56px]' : 'w-[220px]'
      }`}
    >
      <div className="flex items-center gap-3 w-full">
        <div className="bg-[#d89425] p-2 rounded-lg shrink-0 flex items-center justify-center">
          <img src={calendarIcon} alt="" style={{ width: 18, height: 18 }} />
        </div>
        <Label collapsed={collapsed} className="font-bold text-sm text-[#0f172a] dark:text-white">
          GranchPM
        </Label>
      </div>

      <nav className="flex flex-1 min-h-0 flex-col gap-2 w-full">
        {NAV_ROUTES.map((route) => {
          const isActive = location.pathname === route.path
          return (
            <Link
              key={route.key}
              to={route.path}
              className={`flex items-center gap-[10px] px-2 py-[10px] rounded-lg w-full ${
                isActive ? 'bg-[rgba(216,148,37,0.15)]' : ''
              }`}
            >
              {NAV_ICON_RENDERERS[route.key]()}
              <Label
                collapsed={collapsed}
                className={`text-[13px] text-[#0f172a] dark:text-white ${isActive ? 'font-semibold' : 'font-normal'}`}
              >
                {route.label}
              </Label>
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-4 w-full shrink-0">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-[10px] h-8 px-2 w-full cursor-pointer"
        >
          <SimpleIcon
            src={collapsed ? chevronRightIcon : collapseIcon}
            width={collapsed ? 14 : 20}
            height={collapsed ? 14 : 20}
          />
          <Label collapsed={collapsed} className="text-[13px] text-[#475569] dark:text-[#80808c]">
            Свернуть
          </Label>
        </button>

        <div className="flex items-center gap-[10px] pt-4 px-2 w-full border-t border-[#e2e8f0] dark:border-[#27272a]">
          <div className="bg-[#d89425] rounded-[5px] size-5 flex items-center justify-center shrink-0">
            <p className="font-medium text-[9px] leading-[11px] text-white whitespace-nowrap">
              {userInitials}
            </p>
          </div>
          <Label collapsed={collapsed} className="font-medium text-[13px] text-[#0f172a] dark:text-white">
            {userName}
          </Label>
        </div>
      </div>
    </div>
  )
}
