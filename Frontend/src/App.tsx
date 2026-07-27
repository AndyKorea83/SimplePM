import { Sidebar } from './components/Sidebar/Sidebar'

function App() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 h-screen overflow-auto bg-[#0a0a0a]" />
    </div>
  )
}

export default App
