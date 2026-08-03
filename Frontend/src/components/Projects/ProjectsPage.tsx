import { useEffect, useState } from 'react'
import { PageShell } from '../ui/PageShell'
import { Button } from '../ui/Button'
import { SegmentedControl, SegmentedOption } from '../ui/SegmentedControl'
import { GanttSectionHeader } from '../Gantt/GanttSectionHeader'
import { createProject, fetchProjectSummaries, importProject, setProjectClosed, updateProject } from './api'
import { ImportProjectForm, type ImportProjectValues } from './ImportProjectForm'
import { ProjectCard } from './ProjectCard'
import { ProjectForm, type ProjectFormValues } from './ProjectForm'
import type { ProjectSummaryDTO } from './types'

type ModalState = { mode: 'create' } | { mode: 'edit'; project: ProjectSummaryDTO } | { mode: 'import' } | null
type StatusFilter = 'open' | 'closed'

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummaryDTO[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')

  const refetch = () => fetchProjectSummaries().then(setProjects).catch((err: Error) => setError(err.message))

  useEffect(() => {
    refetch()
  }, [])

  const closeModal = () => setModal(null)

  const handleFormSubmit = async (values: ProjectFormValues) => {
    if (modal?.mode === 'create') {
      await createProject(values)
    } else if (modal?.mode === 'edit') {
      await updateProject(modal.project.id, values)
    }
    await refetch()
    closeModal()
  }

  const handleImportSubmit = async (values: ImportProjectValues) => {
    await importProject(values)
    await refetch()
    closeModal()
  }

  const handleToggleClosed = async (project: ProjectSummaryDTO) => {
    await setProjectClosed(project.id, !project.closed)
    await refetch()
  }

  const visibleProjects = projects?.filter((p) => (statusFilter === 'closed' ? p.closed : !p.closed)) ?? null

  return (
    <PageShell>
      <GanttSectionHeader />

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <p className="text-[18px] font-bold text-[var(--text-primary)]">Проекты</p>
          <SegmentedControl>
            <SegmentedOption active={statusFilter === 'open'} onClick={() => setStatusFilter('open')} className="px-3 py-[6px] text-[12px]">
              Открытые
            </SegmentedOption>
            <SegmentedOption active={statusFilter === 'closed'} onClick={() => setStatusFilter('closed')} className="px-3 py-[6px] text-[12px]">
              Закрытые
            </SegmentedOption>
          </SegmentedControl>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setModal({ mode: 'import' })}>
            Импортировать
          </Button>
          <Button variant="primary" onClick={() => setModal({ mode: 'create' })}>
            + Новый проект
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        {error && <p className="text-[14px] text-[#d93333]">Не удалось загрузить проекты: {error}</p>}
        {!error && !visibleProjects && <p className="text-[14px] text-[#94a3b8]">Загрузка…</p>}
        {!error && visibleProjects && visibleProjects.length === 0 && (
          <p className="text-[14px] text-[#94a3b8]">
            {statusFilter === 'closed'
              ? 'Нет закрытых проектов.'
              : 'Пока нет ни одного проекта — создайте новый или импортируйте из XML.'}
          </p>
        )}
        {visibleProjects && visibleProjects.length > 0 && (
          <div className="flex max-w-[960px] flex-col gap-3">
            {visibleProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => setModal({ mode: 'edit', project })}
                onToggleClosed={() => handleToggleClosed(project)}
              />
            ))}
          </div>
        )}
      </div>

      {modal?.mode === 'import' && <ImportProjectForm onSubmit={handleImportSubmit} onClose={closeModal} />}

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <ProjectForm
          mode={modal.mode}
          initialValues={
            modal.mode === 'edit'
              ? { name: modal.project.title || modal.project.name, description: modal.project.description ?? '' }
              : { name: '', description: '' }
          }
          onSubmit={handleFormSubmit}
          onClose={closeModal}
        />
      )}
    </PageShell>
  )
}
