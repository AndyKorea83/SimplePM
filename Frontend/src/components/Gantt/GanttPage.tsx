import { useEffect, useMemo, useState } from 'react'
import { createTask, deleteTask, fetchProject, updateTask } from './api'
import { buildTaskTree, filterTaskTree, flattenVisible } from './buildTaskTree'
import { formatDateRange } from './dateGrid'
import { BottomStatusBar } from './BottomStatusBar'
import { GanttHeader } from './GanttHeader'
import { GanttWorkspace } from './GanttWorkspace'
import { deriveStatus, type TaskStatus } from './status'
import { TaskForm, type TaskFormValues } from './TaskForm'
import type { GanttDensity, GanttScale, ProjectDTO, TaskDTO } from './types'

// MSPDI's sentinel for "no resource assigned"; the placeholder Resource
// (uid 0, "Не назначено") is excluded the same way.
const UNASSIGNED_RESOURCE_UID = -65535

const SCALE_STORAGE_KEY = 'gantt-scale'
const DENSITY_STORAGE_KEY = 'gantt-density'

function isGanttScale(value: string | null): value is GanttScale {
  return value === 'day' || value === 'week' || value === 'month'
}

function isGanttDensity(value: string | null): value is GanttDensity {
  return value === 'default' || value === 'compact' || value === 'dense'
}

const EMPTY_STATUS_COUNTS: Record<TaskStatus, number> = {
  complete: 0,
  inWork: 0,
  planned: 0,
  overdue: 0,
  blocked: 0,
}

export function GanttPage() {
  const [project, setProject] = useState<ProjectDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScaleState] = useState<GanttScale>(() => {
    const saved = localStorage.getItem(SCALE_STORAGE_KEY)
    return isGanttScale(saved) ? saved : 'day'
  })
  const [density, setDensityState] = useState<GanttDensity>(() => {
    const saved = localStorage.getItem(DENSITY_STORAGE_KEY)
    return isGanttDensity(saved) ? saved : 'default'
  })
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set())
  const [activeStatuses, setActiveStatuses] = useState<ReadonlySet<TaskStatus>>(() => new Set())
  const [assigneeFilter, setAssigneeFilter] = useState<number | null>(null)
  const [formState, setFormState] = useState<{ mode: 'create' | 'edit'; task?: TaskDTO } | null>(null)

  const setScale = (next: GanttScale) => {
    localStorage.setItem(SCALE_STORAGE_KEY, next)
    setScaleState(next)
  }
  const setDensity = (next: GanttDensity) => {
    localStorage.setItem(DENSITY_STORAGE_KEY, next)
    setDensityState(next)
  }

  const refetch = () => fetchProject().then(setProject).catch((err: Error) => setError(err.message))

  useEffect(() => {
    refetch()
  }, [])

  const today = useMemo(() => new Date(), [])

  const roots = useMemo(() => (project ? buildTaskTree(project.tasks) : []), [project])

  const resourceUidsByTaskUid = useMemo(() => {
    const map = new Map<number, Set<number>>()
    if (!project) return map
    for (const assignment of project.assignments) {
      if (assignment.resourceUid === UNASSIGNED_RESOURCE_UID || assignment.resourceUid === 0) continue
      const set = map.get(assignment.taskUid) ?? new Set<number>()
      set.add(assignment.resourceUid)
      map.set(assignment.taskUid, set)
    }
    return map
  }, [project])

  const assigneesByTaskUid = useMemo(() => {
    const map = new Map<number, string>()
    if (!project) return map
    const nameByResourceUid = new Map(project.resources.map((r) => [r.uid, r.name]))
    for (const [taskUid, resourceUids] of resourceUidsByTaskUid) {
      const names = [...resourceUids].map((uid) => nameByResourceUid.get(uid)).filter((n): n is string => !!n)
      if (names.length) map.set(taskUid, names.join(', '))
    }
    return map
  }, [project, resourceUidsByTaskUid])

  const teamMembers = useMemo(() => {
    if (!project) return []
    const usedResourceUids = new Set<number>()
    for (const resourceUids of resourceUidsByTaskUid.values()) {
      for (const uid of resourceUids) usedResourceUids.add(uid)
    }
    return project.resources
      .filter((r) => usedResourceUids.has(r.uid))
      .map((r) => ({ uid: r.uid, name: r.name, initials: r.initials || r.name.slice(0, 2).toUpperCase() }))
  }, [project, resourceUidsByTaskUid])

  const matchesFilters = useMemo(() => {
    return (task: TaskDTO) => {
      if (activeStatuses.size > 0 && !activeStatuses.has(deriveStatus(task, today))) return false
      if (assigneeFilter !== null && !resourceUidsByTaskUid.get(task.uid)?.has(assigneeFilter)) return false
      return true
    }
  }, [activeStatuses, assigneeFilter, resourceUidsByTaskUid, today])

  const filteredRoots = useMemo(() => filterTaskTree(roots, matchesFilters), [roots, matchesFilters])

  const { totalTasks, completedPercent, statusCounts } = useMemo(() => {
    if (!project) return { totalTasks: 0, completedPercent: 0, statusCounts: EMPTY_STATUS_COUNTS }
    const leafTasks = project.tasks.filter((t) => !t.isSummary && matchesFilters(t))
    const counts: Record<TaskStatus, number> = { ...EMPTY_STATUS_COUNTS }
    for (const task of leafTasks) {
      counts[deriveStatus(task, today)]++
    }
    const completed = leafTasks.filter((t) => t.percentComplete >= 100).length
    return {
      totalTasks: leafTasks.length,
      completedPercent: leafTasks.length ? Math.round((completed / leafTasks.length) * 100) : 0,
      statusCounts: counts,
    }
  }, [project, today, matchesFilters])

  const toggleStatusFilter = (status: TaskStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const toggleCollapse = (uid: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const resourceOptions = useMemo(
    () => (project ? project.resources.filter((r) => r.uid !== 0).map((r) => ({ uid: r.uid, name: r.name })) : []),
    [project],
  )

  // Every task in document order, indented by depth, minus the task being
  // edited and its own descendants (a task can't become its own ancestor).
  const parentOptions = useMemo(() => {
    const flat = flattenVisible(roots, new Set())
    const editingUid = formState?.mode === 'edit' ? formState.task?.uid : undefined
    let filtered = flat
    if (editingUid !== undefined) {
      const index = flat.findIndex((n) => n.uid === editingUid)
      if (index !== -1) {
        const depth = flat[index].depth
        let end = index + 1
        while (end < flat.length && flat[end].depth > depth) end++
        filtered = [...flat.slice(0, index), ...flat.slice(end)]
      }
    }
    return filtered.map((n) => ({ uid: n.uid, label: '  '.repeat(n.depth) + n.name }))
  }, [roots, formState])

  const openCreateForm = () => setFormState({ mode: 'create' })
  const openEditForm = (uid: number) => {
    const task = project?.tasks.find((t) => t.uid === uid)
    if (task) setFormState({ mode: 'edit', task })
  }
  const closeForm = () => setFormState(null)

  const handleFormSubmit = async (values: TaskFormValues) => {
    const start = new Date(values.start).toISOString()
    const finish = new Date(values.finish).toISOString()

    if (formState?.mode === 'create') {
      await createTask({
        name: values.name,
        parentUid: values.parentUid ?? undefined,
        start,
        finish,
        percentComplete: values.percentComplete,
        isMilestone: values.isMilestone,
        isBlocked: values.isBlocked,
        assigneeResourceUids: values.assigneeResourceUids,
      })
    } else if (formState?.task) {
      await updateTask(formState.task.uid, {
        name: values.name,
        start,
        finish,
        percentComplete: values.percentComplete,
        isBlocked: values.isBlocked,
        assigneeResourceUids: values.assigneeResourceUids,
      })
    }
    await refetch()
    setFormState(null)
  }

  const handleDeleteTask = async () => {
    if (formState?.mode !== 'edit' || !formState.task) return
    await deleteTask(formState.task.uid)
    await refetch()
    setFormState(null)
  }

  const handleFinishChange = async (uid: number, isoDate: string) => {
    try {
      await updateTask(uid, { finish: new Date(isoDate).toISOString() })
      await refetch()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white">
        <p className="text-[14px] text-[#d93333]">Не удалось загрузить проект: {error}</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white">
        <p className="text-[14px] text-[#94a3b8]">Загрузка…</p>
      </div>
    )
  }

  const rangeStart = new Date(project.startDate)
  const rangeEnd = new Date(project.finishDate)

  const formInitialValues: TaskFormValues | null =
    formState === null
      ? null
      : formState.mode === 'edit' && formState.task
        ? {
            name: formState.task.name,
            parentUid: formState.task.parentUid ?? null,
            start: formState.task.start.slice(0, 10),
            finish: formState.task.finish.slice(0, 10),
            percentComplete: formState.task.percentComplete,
            isMilestone: formState.task.isMilestone,
            isBlocked: formState.task.isBlocked,
            assigneeResourceUids: [...(resourceUidsByTaskUid.get(formState.task.uid) ?? [])],
          }
        : {
            name: '',
            parentUid: null,
            start: today.toISOString().slice(0, 10),
            finish: today.toISOString().slice(0, 10),
            percentComplete: 0,
            isMilestone: false,
            isBlocked: false,
            assigneeResourceUids: [],
          }

  const formHasChildren =
    formState?.mode === 'edit' && formState.task
      ? project.tasks.some((t) => t.parentUid === formState.task!.uid)
      : false

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <GanttHeader
        title={project.title || project.name}
        dateRangeLabel={formatDateRange(rangeStart, rangeEnd)}
        scale={scale}
        onScaleChange={setScale}
        density={density}
        onDensityChange={setDensity}
        teamMembers={teamMembers}
        assigneeFilter={assigneeFilter}
        onAssigneeFilterChange={setAssigneeFilter}
        onAddTask={openCreateForm}
      />
      {scale === 'month' ? (
        <div className="flex flex-1 items-center justify-center bg-white">
          <p className="text-[14px] text-[#94a3b8]">Масштаб «Месяцы» пока в разработке</p>
        </div>
      ) : (
        <GanttWorkspace
          roots={filteredRoots}
          scale={scale}
          density={density}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          today={today}
          assigneesByTaskUid={assigneesByTaskUid}
          onEditTask={openEditForm}
          onFinishChange={handleFinishChange}
        />
      )}
      <BottomStatusBar
        totalTasks={totalTasks}
        completedPercent={completedPercent}
        teamInitials={teamMembers.map((m) => m.initials)}
        statusCounts={statusCounts}
        activeStatuses={activeStatuses}
        onToggleStatus={toggleStatusFilter}
      />
      {formState && formInitialValues && (
        <TaskForm
          mode={formState.mode}
          initialValues={formInitialValues}
          parentOptions={parentOptions}
          resourceOptions={resourceOptions}
          hasChildren={formHasChildren}
          onSubmit={handleFormSubmit}
          onDelete={formState.mode === 'edit' ? handleDeleteTask : undefined}
          onClose={closeForm}
        />
      )}
    </div>
  )
}
