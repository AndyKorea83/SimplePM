import { NAV_ROUTES } from '../../navigation'

// Единый источник вкладок раздела (Проекты/Диаграммы/Исполнители) — те же
// данные, что сайдбар использует для пункта "Гантт". Общий и для GanttPage
// (вкладка "Диаграммы"), и для Projects/ProjectsPage (вкладка "Проекты").
export const GANTT_TABS = NAV_ROUTES.find((route) => route.key === 'gantt')!.children!
