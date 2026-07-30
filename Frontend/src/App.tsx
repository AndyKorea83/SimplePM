import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SectionPlaceholder } from './components/SectionPlaceholder/SectionPlaceholder'
import { TabbedSectionPage } from './components/SectionTabs/SectionTabs'
import { GanttPage } from './components/Gantt/GanttPage'
import { CalendarPage } from './components/Calendar/CalendarPage'
import { TimeGroupPlaceholderPage } from './components/Calendar/TimeSectionHeader'
import { NAV_ROUTES, type NavRoute } from './navigation'

// "Время" has real pages behind two of its tabs (Календарь) — the other two
// still share its tab header via TimeGroupPlaceholderPage. Every other group
// (Задачи/Команда/QA) has nothing built yet, so all of its tabs share the
// generic TabbedSectionPage shell.
function routesForGroup(route: NavRoute) {
  if (route.key === 'time') {
    return route.children!.map((child) => (
      <Route
        key={child.key}
        path={child.path}
        element={child.key === 'calendar' ? <CalendarPage /> : <TimeGroupPlaceholderPage title={child.label} />}
      />
    ))
  }
  return route.children!.map((child) => (
    <Route key={child.key} path={child.path} element={<TabbedSectionPage tabs={route.children!} />} />
  ))
}

function pageForLeaf(routeKey: string, label: string) {
  switch (routeKey) {
    case 'gantt':
      return <GanttPage />
    default:
      return <SectionPlaceholder title={label} />
  }
}

function App() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 h-screen overflow-auto bg-white dark:bg-[#0a0a0a]">
        <Routes>
          <Route path="/" element={<Navigate to="/gantt" replace />} />
          {NAV_ROUTES.flatMap((route) =>
            route.children
              ? routesForGroup(route)
              : [<Route key={route.key} path={route.path} element={pageForLeaf(route.key, route.label)} />],
          )}
        </Routes>
      </main>
    </div>
  )
}

export default App
