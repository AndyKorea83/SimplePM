import toggleOffIcon from '../../assets/icons/toggle-off.svg'
import toggleTrackIcon from '../../assets/icons/toggle-track.svg'
import toggleKnobIcon from '../../assets/icons/toggle-knob.svg'
import { useTheme } from '../../theme/ThemeContext'
import { NAV_ROUTES } from '../../navigation'
import { PageShell } from '../ui/PageShell'
import { SectionTabs } from '../SectionTabs/SectionTabs'
import { SectionPlaceholder } from '../SectionPlaceholder/SectionPlaceholder'

// Единый источник вкладок раздела (Календарь/Учет времени/Трудозатраты) —
// те же данные, что сайдбар использует для пункта "Время".
const TIME_TABS = NAV_ROUTES.find((route) => route.key === 'time')!.children!

// Figma (189:3450): светлая тема — оранжевый трек + солнце (toggle-track/
// toggle-knob), тёмная — отдельный цельный ассет (серый трек + луна), а не
// затемнённая/сдвинутая версия светлого.
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative h-5 w-[47px] shrink-0 cursor-pointer"
      aria-pressed={isLight}
      aria-label="Переключить тему"
    >
      {isLight ? (
        <>
          <img src={toggleTrackIcon} alt="" className="absolute inset-0 size-full" />
          <img src={toggleKnobIcon} alt="" className="absolute bottom-[2px] right-[2px] h-4 w-[42px]" />
        </>
      ) : (
        <img src={toggleOffIcon} alt="" className="absolute inset-0 size-full" />
      )}
    </button>
  )
}

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
