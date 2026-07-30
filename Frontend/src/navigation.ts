export type NavKey = 'board' | 'time' | 'gantt' | 'tasks' | 'team' | 'qa' | 'embedded'

export type NavChild = { key: string; label: string; path: string }

export type NavRoute = {
  key: NavKey
  label: string
  // Leaf items navigate to `path` directly; items with `children` instead
  // expand/collapse a submenu in the sidebar and have no page of their own.
  path?: string
  children?: NavChild[]
}

// Matches Figma's "Sidebar" page (issue #25 — "Структура меню"): the nested
// group/submenu layout from the "Version=v2*" symbols, not the old flat list.
export const NAV_ROUTES: NavRoute[] = [
  { key: 'board', label: 'Доска', path: '/board' },
  {
    key: 'time',
    label: 'Время',
    children: [
      { key: 'calendar', label: 'Календарь', path: '/calendar' },
      { key: 'timesheet', label: 'Учет времени', path: '/time/timesheet' },
      { key: 'labor-costs', label: 'Трудозатраты', path: '/time/labor-costs' },
    ],
  },
  { key: 'gantt', label: 'Гантт', path: '/gantt' },
  {
    key: 'tasks',
    label: 'Задачи',
    children: [
      { key: 'current-tasks', label: 'Текущие задачи', path: '/tasks/current' },
      { key: 'untagged-tasks', label: 'Задачи без темы', path: '/tasks/untagged' },
    ],
  },
  {
    key: 'team',
    label: 'Команда',
    children: [
      { key: 'roles', label: 'Роли', path: '/team/roles' },
      { key: 'groups', label: 'Группы', path: '/team/groups' },
    ],
  },
  {
    key: 'qa',
    label: 'QA',
    children: [
      { key: 'bug-report', label: 'Отчет по багам', path: '/qa/bugs' },
      { key: 'qa-board', label: 'Доска', path: '/qa/board' },
    ],
  },
  { key: 'embedded', label: 'Embedded', path: '/embedded' },
]
