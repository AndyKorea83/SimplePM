export type NavKey = 'dashboard' | 'gantt' | 'tasks' | 'team' | 'settings'

export type NavRoute = {
  key: NavKey
  label: string
  path: string
}

export const NAV_ROUTES: NavRoute[] = [
  { key: 'dashboard', label: 'Дашборд', path: '/dashboard' },
  { key: 'gantt', label: 'Диаграмма Ганта', path: '/gantt' },
  { key: 'tasks', label: 'Задачи', path: '/tasks' },
  { key: 'team', label: 'Команда', path: '/team' },
  { key: 'settings', label: 'Настройки', path: '/settings' },
]
