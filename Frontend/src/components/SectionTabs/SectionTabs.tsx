import { Link, useLocation } from 'react-router-dom'
import { SectionPlaceholder } from '../SectionPlaceholder/SectionPlaceholder'

export type SectionTab = { label: string; path: string }

// Shared top tab row for a sidebar group's sub-sections (Время/Задачи/Команда/QA).
// Per user direction, groups don't get a sidebar submenu — switching between a
// group's sub-sections happens via this in-page tab bar instead (pattern taken
// from /calendar's TimeSectionHeader, which composes this for the "Время" group).
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const location = useLocation()
  return (
    <div className="flex items-start gap-6">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path
        return (
          <Link key={tab.path} to={tab.path} className="flex flex-col items-start gap-2 pb-[10px]">
            {/* Font weight stays constant (font-medium) between states — a
                bold/medium switch on click changed the text's width and
                shifted every tab after it. Only color/underline mark active. */}
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

// Generic page shell for groups with no real feature behind them yet
// (Задачи/Команда/QA): tab row on top, placeholder body for whichever tab
// is currently active.
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
