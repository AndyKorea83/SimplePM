import { SectionTabs } from '../SectionTabs/SectionTabs'
import { ThemeToggle } from '../ui/ThemeToggle'
import { GANTT_TABS } from './ganttTabs'

// Верхняя панель вкладок раздела «Гантт» (Проекты/Диаграммы/Исполнители) +
// переключатель темы — общая для GanttPage и ProjectsPage, тот же паттерн,
// что TimeSectionHeader для раздела «Время» (там переключатель темы уже был,
// здесь его не хватало — issue-фикс).
export function GanttSectionHeader() {
  return (
    <div className="flex w-full items-start justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 pb-0 pt-4">
      <SectionTabs tabs={GANTT_TABS} />
      <ThemeToggle />
    </div>
  )
}
