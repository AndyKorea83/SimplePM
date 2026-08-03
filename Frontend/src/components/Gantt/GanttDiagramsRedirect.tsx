import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchProjectSummaries } from '../Projects/api'

export const LAST_PROJECT_STORAGE_KEY = 'gantt-last-project-id'

// "/gantt/diagrams" (без id) — точка входа без выбранного проекта: клик по
// "Гантт" в сайдбаре или переход по вкладке "Диаграммы" напрямую. Резолвит
// последний просмотренный проект (если он ещё существует) или первый из
// списка, и делает redirect на "/gantt/diagrams/{id}" — сам GanttPage
// рассчитан только на конкретный projectId (useParams), без fallback-логики
// внутри себя.
export function GanttDiagramsRedirect() {
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchProjectSummaries()
      .then((projects) => {
        if (cancelled) return
        if (projects.length === 0) {
          // Смотреть нечего — полезнее увидеть пустой список с кнопками
          // создания/импорта, чем пустую диаграмму без проекта.
          setTarget('/gantt/projects')
          return
        }
        const lastId = Number(localStorage.getItem(LAST_PROJECT_STORAGE_KEY))
        const last = projects.find((p) => p.id === lastId)
        setTarget(`/gantt/diagrams/${(last ?? projects[0]).id}`)
      })
      .catch(() => {
        if (!cancelled) setTarget('/gantt/projects')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!target) return null
  return <Navigate to={target} replace />
}
