import { NAV_ROUTES } from '../../navigation'
import { PageShell } from '../ui/PageShell'
import { SectionTabs } from '../SectionTabs/SectionTabs'
import { SectionPlaceholder } from '../SectionPlaceholder/SectionPlaceholder'
import { ThemeToggle } from '../ui/ThemeToggle'

// Единый источник вкладок раздела (Календарь/Учет времени/Трудозатраты) —
// те же данные, что сайдбар использует для пункта "Время".
const TIME_TABS = NAV_ROUTES.find((route) => route.key === 'time')!.children!

// Верхняя строка шапки раздела: вкладки (реальные ссылки, а не просто
// отображение активной) плюс переключатель темы.
export function TimeSectionHeader() {
  return (
    <div className="flex w-full items-start justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 pb-0 pt-4">
      <SectionTabs tabs={TIME_TABS} />
      <ThemeToggle />
    </div>
  )
}

// Заглушка для нереализованной вкладки "Учет времени" — с настоящей шапкой
// (переключатель темы на месте), чтобы переход между вкладками не дёргал вёрстку.
export function TimeGroupPlaceholderPage({ title }: { title: string }) {
  return (
    <PageShell>
      <TimeSectionHeader />
      <div className="min-h-0 flex-1 overflow-auto">
        <SectionPlaceholder title={title} />
      </div>
    </PageShell>
  )
}
