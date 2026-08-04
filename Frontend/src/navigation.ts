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
  {
    key: 'gantt',
    label: 'Планирование',
    // Порядок значим: сайдбар и корневой redirect ведут на children[0]
    // (см. Sidebar.tsx: NavItem/isRouteActive) — «Проекты» первой оставляет
    // диаграмму на месте core-фичи в пункте меню, но стартовой вкладкой
    // становится ещё не реализованный раздел (осознанный выбор пользователя).
    children: [
      { key: 'projects', label: 'Проекты', path: '/gantt/projects' },
      { key: 'diagrams', label: 'Диаграммы', path: '/gantt/diagrams' },
      { key: 'executors', label: 'Исполнители', path: '/gantt/executors' },
    ],
  },
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
    // Порядок и подписи — как в Figma (issue #69): "Задачи тестирования"
    // (Kanban-доска) идёт первой и становится вкладкой по умолчанию для
    // клика по "QA" в сайдбаре — тот же приём, что и у "Гантт" (см.
    // navigation.ts выше, порядок значим для children[0]).
    children: [
      { key: 'qa-board', label: 'Задачи тестирования', path: '/qa/board' },
      { key: 'bug-report', label: 'Отчет по багам', path: '/qa/bugs' },
      { key: 'qa-metrics', label: 'Метрики', path: '/qa/metrics' },
    ],
  },
  { key: 'embedded', label: 'Embedded', path: '/embedded' },
]
