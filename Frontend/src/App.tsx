import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SectionPlaceholder } from './components/SectionPlaceholder/SectionPlaceholder'
import { TabbedSectionPage } from './components/SectionTabs/SectionTabs'
import { GanttPage } from './components/Gantt/GanttPage'
import { CalendarPage } from './components/Calendar/CalendarPage'
import { LaborCostsPage } from './components/Calendar/LaborCostsPage'
import { TimeGroupPlaceholderPage } from './components/Calendar/TimeSectionHeader'
import { NAV_ROUTES, type NavRoute } from './navigation'

function pageForTimeChild(childKey: string, label: string) {
  switch (childKey) {
    case 'calendar':
      return <CalendarPage />
    case 'labor-costs':
      return <LaborCostsPage />
    default:
      return <TimeGroupPlaceholderPage title={label} />
  }
}

// У «Время» под двумя вкладками (Календарь, Трудозатраты) — реальные страницы,
// у третьей — общая шапка через TimeGroupPlaceholderPage. У остальных групп
// (Задачи/Команда/QA) страниц пока нет — все их вкладки идут через заглушку
// TabbedSectionPage.
function routesForGroup(route: NavRoute) {
  if (route.key === 'time') {
    return route.children!.map((child) => (
      <Route key={child.key} path={child.path} element={pageForTimeChild(child.key, child.label)} />
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
      <main className="flex-1 h-screen overflow-auto bg-[var(--surface)]">
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
