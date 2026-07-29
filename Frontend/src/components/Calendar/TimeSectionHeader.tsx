import { useState } from 'react'
import toggleTrackIcon from '../../assets/icons/toggle-track.svg'
import toggleKnobIcon from '../../assets/icons/toggle-knob.svg'

const TABS = [
  { key: 'calendar', label: 'Календарь' },
  { key: 'timesheet', label: 'Учёт времени' },
  { key: 'labor-costs', label: 'Трудозатраты' },
] as const

type TabKey = (typeof TABS)[number]['key']

// Purely decorative for now — no dark-mode variant of this page exists yet
// to switch to, so it just tracks its own on/off visual state.
function ThemeToggle() {
  const [on, setOn] = useState(true)
  return (
    <button
      type="button"
      onClick={() => setOn((value) => !value)}
      className="relative h-5 w-[47px] shrink-0 cursor-pointer"
      aria-pressed={on}
      aria-label="Переключить тему"
    >
      <img src={toggleTrackIcon} alt="" className="absolute inset-0 size-full" style={{ opacity: on ? 1 : 0.4 }} />
      <img
        src={toggleKnobIcon}
        alt=""
        className="absolute bottom-[2px] right-[2px] h-4 w-[42px] transition-transform"
        style={{ transform: on ? undefined : 'translateX(-22px)' }}
      />
    </button>
  )
}

// The header-toolbar's top row: the section's own tabs (only "Календарь" is
// implemented, per the current task — the other two are inert placeholders)
// plus the (decorative) theme toggle.
export function TimeSectionHeader({ activeTab = 'calendar' as TabKey }: { activeTab?: TabKey }) {
  return (
    <div className="flex w-full items-start justify-between border-b border-[#e5e8ed] bg-white px-4 pb-0 pt-4">
      <div className="flex items-start gap-6">
        {TABS.map((tab) => (
          <div key={tab.key} className="flex flex-col items-start gap-2 pb-[10px]">
            <p
              className={`whitespace-nowrap text-[14px] ${
                tab.key === activeTab ? 'font-semibold text-[#0f1729]' : 'font-medium text-[#666e80]'
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
