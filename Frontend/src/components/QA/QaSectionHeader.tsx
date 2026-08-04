import { NAV_ROUTES } from '../../navigation'
import { SectionTabs } from '../SectionTabs/SectionTabs'
import { ThemeToggle } from '../ui/ThemeToggle'

// Тот же паттерн, что Gantt/GanttSectionHeader.tsx — общая панель вкладок
// раздела (Задачи тестирования/Отчет по багам/Метрики) + переключатель
// темы, используется всеми тремя страницами QA.
const QA_TABS = NAV_ROUTES.find((route) => route.key === 'qa')!.children!

export function QaSectionHeader() {
  return (
    <div className="flex w-full items-start justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 pb-0 pt-4">
      <SectionTabs tabs={QA_TABS} />
      <ThemeToggle />
    </div>
  )
}
