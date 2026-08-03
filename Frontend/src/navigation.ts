export type NavKey = 'board' | 'time' | 'gantt' | 'tasks' | 'team' | 'qa' | 'embedded'

export type NavChild = { key: string; label: string; path: string }

export type NavRoute = {
  key: NavKey
  label: string
  // Пункты без children — обычная ссылка на path. У пунктов с children
  // своей страницы нет (сайдбар ведёт на первого ребёнка) — переключение
  // между дочерними разделами идёт через вкладки сверху страницы
  // (SectionTabs/TimeSectionHeader), а не через подменю в сайдбаре.
  path?: string
  children?: NavChild[]
}

// Структура разделов из issue #25. Сайдбар — плоский список (см. Sidebar.tsx),
// а children здесь используется для вкладок (SectionTabs) и таблицы роутов (App.tsx).
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
      { key: 'qa-metrics', label: 'Метрики', path: '/qa/metrics' },
    ],
  },
  { key: 'embedded', label: 'Embedded', path: '/embedded' },
]
