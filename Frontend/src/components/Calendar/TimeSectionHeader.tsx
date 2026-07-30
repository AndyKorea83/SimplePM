import toggleOffIcon from '../../assets/icons/toggle-off.svg'
import toggleTrackIcon from '../../assets/icons/toggle-track.svg'
import toggleKnobIcon from '../../assets/icons/toggle-knob.svg'
import { useTheme } from '../../theme/ThemeContext'
import { NAV_ROUTES } from '../../navigation'
import { SectionTabs } from '../SectionTabs/SectionTabs'
import { SectionPlaceholder } from '../SectionPlaceholder/SectionPlaceholder'

// Single source of truth for this section's sub-pages (Календарь/Учет
// времени/Трудозатраты) — same data the sidebar uses for the "Время" item.
const TIME_TABS = NAV_ROUTES.find((route) => route.key === 'time')!.children!

// Figma (189:3450): light theme = orange track + sun knob (toggle-track/toggle-knob),
// dark theme = a single combined asset (grey track + knob + moon), not a faded/shifted
// version of the light asset.
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

// The header-toolbar's top row: the section's own tabs (Link-based — clicking
// "Учет времени"/"Трудозатраты" actually navigates now, not just a display
// prop) plus the theme toggle.
export function TimeSectionHeader() {
  return (
    <div className="flex w-full items-start justify-between border-b border-[#e5e8ed] bg-white px-4 pb-0 pt-4 dark:border-[#27272a] dark:bg-[#111111]">
      <SectionTabs tabs={TIME_TABS} />
      <ThemeToggle />
    </div>
  )
}

// Placeholder body for the not-yet-built "Время" sub-sections (Учет
// времени/Трудозатраты) — still uses the real header (with the theme toggle)
// so switching tabs between them and "Календарь" stays visually seamless.
export function TimeGroupPlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-[#111111]">
      <TimeSectionHeader />
      <div className="min-h-0 flex-1 overflow-auto">
        <SectionPlaceholder title={title} />
      </div>
    </div>
  )
}
