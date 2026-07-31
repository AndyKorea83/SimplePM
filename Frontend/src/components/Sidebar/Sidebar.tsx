import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { NAV_ROUTES, type NavKey, type NavRoute } from '../../navigation'
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

// "Доска" — три полоски, рисуем сами (в Figma для них нет отдельного ассета,
// просто три цветных прямоугольника).
function BoardIcon() {
  return (
    <span className="relative block size-5 shrink-0">
      <span className="absolute left-[4px] top-[5px] h-[10px] w-[3px] rounded-[1px] bg-[#888d9d]" />
      <span className="absolute left-[8.5px] top-[5px] h-[7px] w-[3px] rounded-[1px] bg-[#888d9d]" />
      <span className="absolute left-[13px] top-[5px] h-[12px] w-[3px] rounded-[1px] bg-[#888d9d]" />
    </span>
  )
}

// "Время" — циферблат собран из трёх экспортированных частей (круг + стрелки).
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

// Натуральные размеры иконок из Figma — растягивание в единый квадрат
// искажает пропорции, поэтому у каждой свой размер.
const NAV_ICON_RENDERERS: Record<NavKey, () => ReactNode> = {
  board: () => <BoardIcon />,
  time: () => <ClockIcon />,
  gantt: () => <SimpleIcon src={barChartIcon} width={9.5} height={13.5} rotate={90} />,
  tasks: () => <SimpleIcon src={checkIcon} width={12.5} height={9} />,
  team: () => <SimpleIcon src={userIcon} width={11.5} height={12.5} />,
  qa: () => <SimpleIcon src={bugIcon} width={15.636} height={16} />,
  embedded: () => <SimpleIcon src={cpuIcon} width={16} height={16} />,
}

// Всегда в DOM; ширина/прозрачность анимируются синхронно с шириной сайдбара,
// чтобы подпись не появлялась/пропадала раньше контейнера (был визуальный скачок).
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

// Строка меню. У групп (Время/Задачи/Команда/QA) подменю нет — переход внутри
// группы идёт через вкладки на самой странице (SectionTabs/TimeSectionHeader),
// поэтому строка группы — обычная ссылка на первого ребёнка, как у листового пункта.
function NavItem({ route, collapsed, isActive }: { route: NavRoute; collapsed: boolean; isActive: boolean }) {
  const path = route.path ?? route.children![0].path
  return (
    <Link
      to={path}
      className={`flex items-center gap-[10px] px-2 py-[10px] rounded-lg w-full ${
        isActive ? 'bg-[rgba(216,148,37,0.15)]' : 'hover:bg-[rgba(216,148,37,0.08)]'
      }`}
    >
      {NAV_ICON_RENDERERS[route.key]()}
      <Label
        collapsed={collapsed}
        className={`text-[13px] text-[#212121] dark:text-white ${isActive ? 'font-semibold' : 'font-normal'}`}
      >
        {route.label}
      </Label>
    </Link>
  )
}

function isRouteActive(route: NavRoute, pathname: string): boolean {
  return route.children ? route.children.some((child) => child.path === pathname) : pathname === route.path
}

const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed'

export function Sidebar() {
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
      // Цвет сайдбара (--sidebar-surface) всегда отличается от фона основной
      // части (--surface) — граница не нужна.
      className={`bg-[var(--sidebar-surface)] h-screen flex flex-col items-start gap-4 py-4 px-[10px] shrink-0 overflow-hidden transition-[width] duration-200 ${
        collapsed ? 'w-[56px]' : 'w-[220px]'
      }`}
    >
      <div className="flex items-center gap-3 w-full">
        <div className="bg-[#d89425] p-2 rounded-lg shrink-0 flex items-center justify-center">
          <img src={calendarIcon} alt="" style={{ width: 18, height: 18 }} />
        </div>
        <Label collapsed={collapsed} className="font-bold text-sm text-[#212121] dark:text-white">
          GranchPM
        </Label>
      </div>

      <nav className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto w-full">
        {NAV_ROUTES.map((route) => (
          <NavItem key={route.key} route={route} collapsed={collapsed} isActive={isRouteActive(route, location.pathname)} />
        ))}
      </nav>

      <div className="w-full shrink-0 border-t border-[var(--border)] pt-4">
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
          <Label collapsed={collapsed} className="text-[13px] text-[#80808c]">
            Свернуть
          </Label>
        </button>
      </div>
    </div>
  )
}
