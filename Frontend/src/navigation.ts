export type NavKey = 'board' | 'calendar' | 'gantt' | 'tasks' | 'team' | 'qa' | 'embedded'

export type NavRoute = {
  key: NavKey
  label: string
  path: string
}

// Matches the Figma "timesheet-page - light" sidebar: Проекты is gone, and
// Настройки/Дашборд are replaced by this exact set/order.
export const NAV_ROUTES: NavRoute[] = [
  { key: 'board', label: 'Доска', path: '/board' },
  { key: 'calendar', label: 'Время', path: '/calendar' },
  { key: 'gantt', label: 'Гантт', path: '/gantt' },
  { key: 'tasks', label: 'Задачи', path: '/tasks' },
  { key: 'team', label: 'Команда', path: '/team' },
  { key: 'qa', label: 'QA', path: '/qa' },
  { key: 'embedded', label: 'Embedded', path: '/embedded' },
]
