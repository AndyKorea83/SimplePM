import { Link } from 'react-router-dom'
import { downloadProjectExport } from './api'
import type { ProjectSummaryDTO } from './types'

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Иконки нарисованы инлайново (не img-ассеты) — так цвет берётся через
// currentColor/CSS-переменную и сам подстраивается под тему, без пары
// light/dark файлов (см. прецедент close-dark.svg/close-light.svg — здесь
// это не нужно, т.к. это не Figma-элемент, а собственная задумка страницы).
function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 1.5L15 14H1L8 1.5Z"
        stroke="#FF974C"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 6.5V9.5" stroke="#FF974C" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.8" fill="#FF974C" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.5 1.5L12.5 4.5L4.5 12.5H1.5V9.5L9.5 1.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.5 3.5L10.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

// Замок: дужка разомкнута у открытого проекта, замкнута у закрытого —
// одна и та же иконка, форма дужки зависит от locked.
function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="6" width="9" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      {locked ? (
        <path d="M4.5 6V4C4.5 2.62 5.62 1.5 7 1.5C8.38 1.5 9.5 2.62 9.5 4V6" stroke="currentColor" strokeWidth="1.3" />
      ) : (
        <path d="M4.5 6V4C4.5 2.62 5.62 1.5 7 1.5C8.38 1.5 9.5 2.62 9.5 4" stroke="currentColor" strokeWidth="1.3" />
      )}
    </svg>
  )
}

type ProjectCardProps = {
  project: ProjectSummaryDTO
  onEdit: () => void
  onToggleClosed: () => void
}

export function ProjectCard({ project, onEdit, onToggleClosed }: ProjectCardProps) {
  return (
    <Link
      to={`/gantt/diagrams/${project.id}`}
      className={`flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[#d89425] ${
        project.closed ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-bold text-[var(--text-primary)]">{project.title || project.name}</p>
          {project.closed && (
            <span className="rounded bg-[#f2f5f7] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)] dark:bg-[#1c1c1e]">
              Закрыт
            </span>
          )}
          {project.behindSchedule && (
            <span title="Отставание от графика">
              <WarningIcon />
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit()
            }}
            aria-label="Редактировать проект"
            className="cursor-pointer rounded p-1.5 text-[var(--text-secondary)] hover:bg-[#f2f5f7] dark:hover:bg-[#1c1c1e]"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleClosed()
            }}
            aria-label={project.closed ? 'Открыть проект' : 'Закрыть проект'}
            title={project.closed ? 'Открыть проект' : 'Закрыть проект'}
            className="cursor-pointer rounded p-1.5 text-[var(--text-secondary)] hover:bg-[#f2f5f7] dark:hover:bg-[#1c1c1e]"
          >
            <LockIcon locked={project.closed} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              downloadProjectExport(project.id)
            }}
            aria-label="Экспортировать проект в XML"
            className="cursor-pointer rounded p-1.5 text-[var(--text-secondary)] hover:bg-[#f2f5f7] dark:hover:bg-[#1c1c1e]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M7 1.75V8.75M7 8.75L4 5.75M7 8.75L10 5.75M2.25 10.25V11.25C2.25 11.8023 2.69772 12.25 3.25 12.25H10.75C11.3023 12.25 11.75 11.8023 11.75 11.25V10.25"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {project.description && <p className="text-[13px] text-[var(--text-secondary)]">{project.description}</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--text-secondary)]">
        <span>
          Создан {formatDate(project.createdAt)}, {project.createdBy}
        </span>
        <span>Срок завершения: {project.computedFinish ? formatDate(project.computedFinish) : '—'}</span>
        <span>
          Задачи: {project.taskDone}/{project.taskTotal}
        </span>
      </div>
    </Link>
  )
}
