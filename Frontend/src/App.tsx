import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SectionPlaceholder } from './components/SectionPlaceholder/SectionPlaceholder'
import { TabbedSectionPage } from './components/SectionTabs/SectionTabs'
import { GanttPage } from './components/Gantt/GanttPage'
import { GanttDiagramsRedirect } from './components/Gantt/GanttDiagramsRedirect'
import { ProjectsPage } from './components/Projects/ProjectsPage'
import { KanbanPage } from './components/QA/KanbanPage'
import { BugReportPage } from './components/QA/BugReportPage'
import { QaMetricsPage } from './components/QA/QaMetricsPage'
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

// У вкладок "Проекты" и "Диаграммы" — реальные страницы (обе сами рисуют
// вкладки над своей шапкой, см. ProjectsPage/GanttPage); "Диаграммы" без id
// в пути — точка входа, резолвящая на "/gantt/diagrams/:projectId" (см.
// GanttDiagramsRedirect). У "Исполнителей" данных пока нет — заглушка через
// TabbedSectionPage, как у Задач/Команды/QA.
function pageForGanttChild(childKey: string) {
  switch (childKey) {
    case 'projects':
      return <ProjectsPage />
    case 'diagrams':
      return <GanttDiagramsRedirect />
    default:
      return undefined
  }
}

// У «Время» под двумя вкладками (Календарь, Трудозатраты) — реальные страницы,
// у третьей — общая шапка через TimeGroupPlaceholderPage. У остальных групп
// (Задачи/Команда/QA) страниц пока нет — все их вкладки идут через заглушку
// TabbedSectionPage.
function pageForQaChild(childKey: string) {
  switch (childKey) {
    case 'qa-board':
      return <KanbanPage />
    case 'bug-report':
      return <BugReportPage />
    case 'qa-metrics':
      return <QaMetricsPage />
    default:
      return undefined
  }
}

function routesForGroup(route: NavRoute) {
  if (route.key === 'time') {
    return route.children!.map((child) => (
      <Route key={child.key} path={child.path} element={pageForTimeChild(child.key, child.label)} />
    ))
  }
  if (route.key === 'gantt') {
    return [
      ...route.children!.map((child) => (
        <Route
          key={child.key}
          path={child.path}
          element={pageForGanttChild(child.key) ?? <TabbedSectionPage tabs={route.children!} />}
        />
      )),
      <Route key="gantt-diagram-detail" path="/gantt/diagrams/:projectId" element={<GanttPage />} />,
    ]
  }
  if (route.key === 'qa') {
    return route.children!.map((child) => (
      <Route
        key={child.key}
        path={child.path}
        element={pageForQaChild(child.key) ?? <TabbedSectionPage tabs={route.children!} />}
      />
    ))
  }
  return route.children!.map((child) => (
    <Route key={child.key} path={child.path} element={<TabbedSectionPage tabs={route.children!} />} />
  ))
}

function App() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 h-screen overflow-auto bg-[var(--surface)]">
        <Routes>
          <Route path="/" element={<Navigate to="/gantt/projects" replace />} />
          {NAV_ROUTES.flatMap((route) =>
            route.children
              ? routesForGroup(route)
              : [<Route key={route.key} path={route.path} element={<SectionPlaceholder title={route.label} />} />],
          )}
        </Routes>
      </main>
    </div>
  )
}

export default App
