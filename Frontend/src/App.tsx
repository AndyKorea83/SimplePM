import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SectionPlaceholder } from './components/SectionPlaceholder/SectionPlaceholder'
import { NAV_ROUTES } from './navigation'

function App() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 h-screen overflow-auto bg-[#0a0a0a]">
        <Routes>
          <Route path="/" element={<Navigate to="/gantt" replace />} />
          {NAV_ROUTES.map((route) => (
            <Route
              key={route.key}
              path={route.path}
              element={<SectionPlaceholder title={route.label} />}
            />
          ))}
        </Routes>
      </main>
    </div>
  )
}

export default App
