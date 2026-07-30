import toggleOffIcon from '../../assets/icons/toggle-off.svg'
import toggleTrackIcon from '../../assets/icons/toggle-track.svg'
import toggleKnobIcon from '../../assets/icons/toggle-knob.svg'
import { useTheme } from '../../theme/ThemeContext'

const TABS = [
  { key: 'calendar', label: 'Календарь' },
  { key: 'timesheet', label: 'Учёт времени' },
  { key: 'labor-costs', label: 'Трудозатраты' },
] as const

type TabKey = (typeof TABS)[number]['key']

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

// The header-toolbar's top row: the section's own tabs (only "Календарь" is
// implemented, per the current task — the other two are inert placeholders)
// plus the theme toggle.
export function TimeSectionHeader({ activeTab = 'calendar' as TabKey }: { activeTab?: TabKey }) {
  return (
    <div className="flex w-full items-start justify-between border-b border-[#e5e8ed] bg-white px-4 pb-0 pt-4 dark:border-[#27272a] dark:bg-[#111111]">
      <div className="flex items-start gap-6">
        {TABS.map((tab) => (
          <div key={tab.key} className="flex flex-col items-start gap-2 pb-[10px]">
            <p
              className={`whitespace-nowrap text-[14px] ${
                tab.key === activeTab
                  ? 'font-semibold text-[#0f1729] dark:text-[#f2f2f7]'
                  : 'font-medium text-[#666e80] dark:text-[#808794]'
              }`}
            >
              {tab.label}
            </p>
            {tab.key === activeTab && <div className="h-[2px] w-full bg-[#d89425]" />}
          </div>
        ))}
      </div>
      <ThemeToggle />
    </div>
  )
}
