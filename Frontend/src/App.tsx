import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SectionPlaceholder } from './components/SectionPlaceholder/SectionPlaceholder'
import { GanttPage } from './components/Gantt/GanttPage'
import { CalendarPage } from './components/Calendar/CalendarPage'
import { NAV_ROUTES } from './navigation'

function pageFor(routeKey: string, label: string) {
  switch (routeKey) {
    case 'gantt':
      return <GanttPage />
    case 'calendar':
      return <CalendarPage />
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
          {NAV_ROUTES.map((route) => (
            <Route key={route.key} path={route.path} element={pageFor(route.key, route.label)} />
          ))}
        </Routes>
      </main>
    </div>
  )
}

export default App
