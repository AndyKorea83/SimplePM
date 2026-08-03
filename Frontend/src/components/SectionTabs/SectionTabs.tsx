import { Link, useLocation } from 'react-router-dom'
import { PageShell } from '../ui/PageShell'
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
        // Точное совпадение ИЛИ вложенный путь — нужно вкладке "Диаграммы"
        // (см. Gantt/GanttPage.tsx), у которой реальный URL содержит id
        // проекта (`/gantt/diagrams/42`), а не сам путь таба.
        const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/')
        return (
          <Link key={tab.path} to={tab.path} className="flex flex-col items-start gap-2 pb-[10px]">
            {/* Подсветка — на отдельном span вокруг текста (симметричный py),
                а не на всём Link: иначе pb-[10px] (отступ под подчёркивание)
                попадал в область подсветки и текст казался смещённым вверх. */}
            {/* Начертание не меняется (всегда font-medium) — смена веса шрифта
                меняла ширину текста и сдвигала соседние вкладки. Активность
                показывают только цвет и подчёркивание. */}
            <span
              className={`-mx-2 -my-1 whitespace-nowrap rounded px-2 py-1 text-[14px] font-medium ${
                isActive
                  ? 'text-[var(--text-primary)]'
                  : 'text-[#666e80] hover:bg-[#f2f5f7] dark:text-[#808794] dark:hover:bg-[#1c1c1e]'
              }`}
            >
              {tab.label}
            </span>
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
    <PageShell>
      <div className="flex w-full items-start border-b border-[var(--border)] px-4 pb-0 pt-4">
        <SectionTabs tabs={tabs} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <SectionPlaceholder title={activeTab?.label ?? ''} />
      </div>
    </PageShell>
  )
}
