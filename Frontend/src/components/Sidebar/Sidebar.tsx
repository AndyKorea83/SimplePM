import { useState } from 'react'
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

type NavKey = 'dashboard' | 'gantt' | 'tasks' | 'team' | 'settings'

type NavItem = {
  key: NavKey
  label: string
  icon: string
}

type ProjectItem = {
  key: string
  name: string
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Дашборд', icon: homeIcon },
  { key: 'gantt', label: 'Диаграмма Ганта', icon: barChartIcon },
  { key: 'tasks', label: 'Задачи', icon: checkIcon },
  { key: 'team', label: 'Команда', icon: userIcon },
  { key: 'settings', label: 'Настройки', icon: settingsIcon },
]

const PROJECT_ITEMS: ProjectItem[] = [
  { key: 'all', name: 'Все проекты' },
  { key: 'platform', name: 'Разработка платформы' },
  { key: 'marketing', name: 'Маркетинг кампании' },
  { key: 'redesign', name: 'Редизайн сайта' },
]

type SidebarProps = {
  activeNavKey?: NavKey
  activeProjectKey?: string
  userInitials?: string
  userName?: string
}

const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed'

export function Sidebar({
  activeNavKey = 'gantt',
  activeProjectKey = 'platform',
  userInitials = 'АК',
  userName = 'Алексей К.',
}: SidebarProps) {
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
      className={`bg-[#111111] h-screen flex flex-col gap-4 py-4 shrink-0 transition-[width] duration-200 ${
        collapsed ? 'w-[56px] items-center' : 'w-[220px] items-start px-[10px]'
      }`}
    >
      <div className={`flex items-center gap-3 w-full ${collapsed ? 'justify-center' : ''}`}>
        <div className="bg-[#d89425] p-2 rounded-lg shrink-0 flex items-center justify-center">
          <img src={calendarIcon} alt="" className="size-5" />
        </div>
        {!collapsed && (
          <p className="font-bold text-sm text-white whitespace-nowrap">GranchPM</p>
        )}
      </div>

      <nav className={`flex flex-col gap-2 w-full ${collapsed ? 'flex-1 min-h-0' : 'shrink-0'}`}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activeNavKey
          return (
            <a
              key={item.key}
              href="#"
              className={`flex items-center gap-[10px] px-2 py-[10px] rounded-lg shrink-0 ${
                collapsed ? 'justify-center' : 'w-[200px]'
              } ${isActive ? 'bg-[rgba(216,148,37,0.15)]' : ''}`}
            >
              <img src={item.icon} alt="" className="size-5 shrink-0" />
              {!collapsed && (
                <p
                  className={`text-[13px] text-white whitespace-nowrap ${
                    isActive ? 'font-semibold' : 'font-normal'
                  }`}
                >
                  {item.label}
                </p>
              )}
            </a>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="flex flex-col gap-px w-full flex-1 min-h-0">
          <p className="text-[10px] text-[#80808c]">Проекты</p>
          {PROJECT_ITEMS.map((project) => (
            <div key={project.key} className="flex items-center gap-2 px-2 py-[6px] w-[200px]">
              <img
                src={project.key === activeProjectKey ? dotActiveIcon : dotIcon}
                alt=""
                className="size-[6px] shrink-0"
              />
              <p className="text-[13px] text-[#d9d9e5] whitespace-nowrap">{project.name}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 w-full shrink-0">
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`flex items-center gap-[10px] h-8 px-2 py-[10px] w-full cursor-pointer ${
            collapsed ? 'justify-center rounded-[16px] size-8' : ''
          }`}
        >
          <img
            src={collapsed ? chevronRightIcon : collapseIcon}
            alt=""
            className="size-5 shrink-0"
          />
          {!collapsed && <p className="text-[13px] text-[#80808c] text-left">Свернуть</p>}
        </button>

        <div
          className={`flex items-center gap-[10px] pt-4 w-full border-t border-[#27272a] ${
            collapsed ? 'justify-center' : 'px-2'
          }`}
        >
          <div className="bg-[#d89425] rounded-[5px] size-5 flex items-center justify-center shrink-0">
            <p className="font-medium text-[9px] text-white whitespace-nowrap">{userInitials}</p>
          </div>
          {!collapsed && (
            <p className="font-medium text-[13px] text-white whitespace-nowrap">{userName}</p>
          )}
        </div>
      </div>
    </div>
  )
}
