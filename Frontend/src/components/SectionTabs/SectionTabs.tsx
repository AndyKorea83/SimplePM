import { Link, useLocation } from 'react-router-dom'
import { SectionPlaceholder } from '../SectionPlaceholder/SectionPlaceholder'

export type SectionTab = { label: string; path: string }

// Общая панель вкладок для подразделов группы сайдбара (Время/Задачи/Команда/QA).
// Подменю в сайдбаре не используется — переключение идёт через эти вкладки на
// странице (паттерн взят из TimeSectionHeader на /calendar, где он собирается
// из этого же компонента для группы "Время").
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const location = useLocation()
  return (
    <div className="flex items-start gap-6">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path
        return (
          <Link key={tab.path} to={tab.path} className="flex flex-col items-start gap-2 pb-[10px]">
            {/* Начертание не меняется (всегда font-medium) — смена веса шрифта
                меняла ширину текста и сдвигала соседние вкладки. Активность
                показывают только цвет и подчёркивание. */}
            <p
              className={`whitespace-nowrap text-[14px] font-medium ${
                isActive ? 'text-[#0f1729] dark:text-[#f2f2f7]' : 'text-[#666e80] dark:text-[#808794]'
              }`}
            >
              {tab.label}
            </p>
            {isActive && <div className="h-[2px] w-full bg-[#d89425]" />}
          </Link>
        )
      })}
    </div>
  )
}

// Общая заготовка страницы для групп без реального функционала (Задачи/
// Команда/QA): вкладки сверху, заглушка под активную вкладку.
export function TabbedSectionPage({ tabs }: { tabs: SectionTab[] }) {
  const location = useLocation()
  const activeTab = tabs.find((tab) => tab.path === location.pathname)
  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-[#111111]">
      <div className="flex w-full items-start border-b border-[#e5e8ed] px-4 pb-0 pt-4 dark:border-[#27272a]">
        <SectionTabs tabs={tabs} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <SectionPlaceholder title={activeTab?.label ?? ''} />
      </div>
    </div>
  )
}
