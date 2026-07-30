export type NavKey = 'board' | 'time' | 'gantt' | 'tasks' | 'team' | 'qa' | 'embedded'

export type NavChild = { key: string; label: string; path: string }

export type NavRoute = {
  key: NavKey
  label: string
  // Leaf items navigate to `path` directly and have no sub-navigation. Items
  // with `children` have no page of their own in the sidebar (it links to the
  // first child) — their sub-sections switch via an in-page top tab bar
  // instead (SectionTabs/TimeSectionHeader), not a sidebar submenu.
  path?: string
  children?: NavChild[]
}

// Section/sub-section structure from issue #25 ("Структура меню"). The
// sidebar itself stays a flat list (see Sidebar.tsx) — `children` here drives
// each group's top tab bar (SectionTabs) and route table (App.tsx) instead.
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
