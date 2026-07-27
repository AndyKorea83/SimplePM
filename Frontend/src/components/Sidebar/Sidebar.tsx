import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { NAV_ROUTES, type NavKey } from '../../navigation'
import homeIcon from '../../assets/icons/home.svg'
import calendarIcon from '../../assets/icons/calendar.svg'
import barChartIcon from '../../assets/icons/bar-chart.svg'
import checkIcon from '../../assets/icons/check.svg'
import userIcon from '../../assets/icons/user.svg'
import settingsIcon from '../../assets/icons/settings.svg'
import chevronRightIcon from '../../assets/icons/chevron-right.svg'
import collapseIcon from '../../assets/icons/collapse.svg'
import dotIcon from '../../assets/icons/dot.svg'
import dotActiveIcon from '../../assets/icons/dot-alt.svg'

type IconSpec = {
  src: string
  width: number
  height: number
  rotate?: number
}

// Natural pixel dimensions of each exported Figma icon (node 3:930) — rendering
// them stretched to a uniform square distorts aspect ratio, so each keeps its own size.
const NAV_ICONS: Record<NavKey, IconSpec> = {
  dashboard: { src: homeIcon, width: 17.5, height: 17.5 },
  gantt: { src: barChartIcon, width: 9.5, height: 13.5, rotate: 90 },
  tasks: { src: checkIcon, width: 12.5, height: 9 },
  team: { src: userIcon, width: 11.5, height: 12.5 },
  settings: { src: settingsIcon, width: 17.5, height: 17.5 },
}

type ProjectItem = {
  key: string
  name: string
}

const PROJECT_ITEMS: ProjectItem[] = [
  { key: 'all', name: 'Все проекты' },
  { key: 'platform', name: 'Разработка платформы' },
  { key: 'marketing', name: 'Маркетинг кампании' },
  { key: 'redesign', name: 'Редизайн сайта' },
]

function Icon({ src, width, height, rotate }: IconSpec) {
  return (
    <span className="flex items-center justify-center shrink-0 size-5">
      <img
        src={src}
        alt=""
        style={{ width, height, transform: rotate ? `rotate(${rotate}deg)` : undefined }}
      />
    </span>
  )
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
  defaultActiveProjectKey?: string
  userInitials?: string
  userName?: string
}

const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed'

export function Sidebar({
  defaultActiveProjectKey = 'platform',
  userInitials = 'АК',
  userName = 'Алексей К.',
}: SidebarProps) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_STORAGE_KEY) !== 'false',
  )
  const [activeProjectKey, setActiveProjectKey] = useState(defaultActiveProjectKey)

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <div
      className={`bg-[#111111] h-screen flex flex-col items-start gap-4 py-4 px-[10px] shrink-0 overflow-hidden transition-[width] duration-200 ${
        collapsed ? 'w-[56px]' : 'w-[220px]'
      }`}
    >
      <div className="flex items-center gap-3 w-full">
        <div className="bg-[#d89425] p-2 rounded-lg shrink-0 flex items-center justify-center">
          <img src={calendarIcon} alt="" style={{ width: 18, height: 18 }} />
        </div>
        <Label collapsed={collapsed} className="font-bold text-sm text-white">
          GranchPM
        </Label>
      </div>

      <nav className={`flex flex-col gap-2 w-full ${collapsed ? 'flex-1 min-h-0' : 'shrink-0'}`}>
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
              <Icon {...NAV_ICONS[route.key]} />
              <Label
                collapsed={collapsed}
                className={`text-[13px] text-white ${isActive ? 'font-semibold' : 'font-normal'}`}
              >
                {route.label}
              </Label>
            </Link>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="flex flex-col gap-px w-full flex-1 min-h-0">
          <p className="text-[10px] leading-[12px] text-[#80808c]">Проекты</p>
          {PROJECT_ITEMS.map((project) => (
            <button
              key={project.key}
              type="button"
              onClick={() => setActiveProjectKey(project.key)}
              className="flex items-center gap-2 px-2 py-[6px] w-full cursor-pointer"
            >
              <img
                src={project.key === activeProjectKey ? dotActiveIcon : dotIcon}
                alt=""
                className="shrink-0"
                style={{ width: 6, height: 6 }}
              />
              <p className="text-[13px] leading-[16px] text-[#d9d9e5] whitespace-nowrap overflow-hidden text-ellipsis">
                {project.name}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 w-full shrink-0">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-[10px] h-8 px-2 w-full cursor-pointer"
        >
          <Icon
            src={collapsed ? chevronRightIcon : collapseIcon}
            width={collapsed ? 14 : 20}
            height={collapsed ? 14 : 20}
          />
          <Label collapsed={collapsed} className="text-[13px] text-[#80808c]">
            Свернуть
          </Label>
        </button>

        <div className="flex items-center gap-[10px] pt-4 px-2 w-full border-t border-[#27272a]">
          <div className="bg-[#d89425] rounded-[5px] size-5 flex items-center justify-center shrink-0">
            <p className="font-medium text-[9px] leading-[11px] text-white whitespace-nowrap">
              {userInitials}
            </p>
          </div>
          <Label collapsed={collapsed} className="font-medium text-[13px] text-white">
            {userName}
          </Label>
        </div>
      </div>
    </div>
  )
}
