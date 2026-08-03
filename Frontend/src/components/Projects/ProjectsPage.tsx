import { useEffect, useState } from 'react'
import { PageShell } from '../ui/PageShell'
import { Button } from '../ui/Button'
import { SectionTabs } from '../SectionTabs/SectionTabs'
import { GANTT_TABS } from '../Gantt/ganttTabs'
import { createProject, fetchProjectSummaries, importProject, updateProject } from './api'
import { ImportProjectForm, type ImportProjectValues } from './ImportProjectForm'
import { ProjectCard } from './ProjectCard'
import { ProjectForm, type ProjectFormValues } from './ProjectForm'
import type { ProjectSummaryDTO } from './types'

type ModalState = { mode: 'create' } | { mode: 'edit'; project: ProjectSummaryDTO } | { mode: 'import' } | null

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummaryDTO[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)

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

  return (
    <PageShell>
      <div className="flex w-full items-start border-b border-[var(--border)] px-4 pb-0 pt-4">
        <SectionTabs tabs={GANTT_TABS} />
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-[18px] font-bold text-[var(--text-primary)]">Проекты</p>
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
        {!error && !projects && <p className="text-[14px] text-[#94a3b8]">Загрузка…</p>}
        {!error && projects && projects.length === 0 && (
          <p className="text-[14px] text-[#94a3b8]">Пока нет ни одного проекта — создайте новый или импортируйте из XML.</p>
        )}
        {projects && projects.length > 0 && (
          <div className="flex flex-col gap-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onEdit={() => setModal({ mode: 'edit', project })} />
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
