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

  // Кандидаты в предшественники: сама задача исключена, а в режиме
  // редактирования — ещё и все задачи, которые (транзитивно) зависят от
  // редактируемой, иначе выбор создал бы цикл (backend всё равно проверяет
  // цикл авторитетно — это лишь клиентская подсказка, чтобы не предлагать
  // заведомо невалидный вариант).
  const predecessorOptions = useMemo(() => {
    if (!project) return []
    const editingUid = formState?.mode === 'edit' ? formState.task?.uid : undefined
    const excluded = new Set<number>()
    if (editingUid !== undefined) {
      excluded.add(editingUid)
      const successorsOf = new Map<number, number[]>()
      for (const t of project.tasks) {
        for (const dep of t.dependencies ?? []) {
          const arr = successorsOf.get(dep.predecessorUid) ?? []
          arr.push(t.uid)
          successorsOf.set(dep.predecessorUid, arr)
        }
      }
      const queue = [editingUid]
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const successorUid of successorsOf.get(current) ?? []) {
          if (!excluded.has(successorUid)) {
            excluded.add(successorUid)
            queue.push(successorUid)
          }
        }
      }
    }
    return project.tasks.filter((t) => !excluded.has(t.uid)).map((t) => ({ uid: t.uid, label: t.name }))
  }, [project, formState])

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
        dependencies: values.dependencies,
      })
    } else if (formState?.task) {
      await updateTask(formState.task.uid, {
        name: values.name,
        start,
        finish,
        percentComplete: values.percentComplete,
        isBlocked: values.isBlocked,
        assigneeResourceUids: values.assigneeResourceUids,
        dependencies: values.dependencies,
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

  const handleStartChange = async (uid: number, isoDate: string) => {
    try {
      await updateTask(uid, { start: new Date(isoDate).toISOString() })
      await refetch()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
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
      <div className="flex h-full w-full items-center justify-center bg-white dark:bg-[#1a1a1a]">
        <p className="text-[14px] text-[#d93333]">Не удалось загрузить проект: {error}</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white dark:bg-[#1a1a1a]">
        <p className="text-[14px] text-[#94a3b8]">Загрузка…</p>
      </div>
    )
  }

  // project.startDate/finishDate come straight from the XML import and never
  // move afterward — if a task's dates are dragged/edited past them, the
  // rendered grid (built from these two dates) wouldn't extend far enough to
  // show it. Widen the range to always cover every task's actual dates too.
  const rangeStart = project.tasks.reduce((min, t) => {
    const start = new Date(t.start)
    return start < min ? start : min
  }, new Date(project.startDate))
  const rangeEnd = project.tasks.reduce((max, t) => {
    const finish = new Date(t.finish)
    return finish > max ? finish : max
  }, new Date(project.finishDate))

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
            dependencies: (formState.task.dependencies ?? []).map((d) => ({
              predecessorUid: d.predecessorUid,
              type: d.type,
            })),
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
            dependencies: [],
          }

  const formHasChildren =
    formState?.mode === 'edit' && formState.task
      ? project.tasks.some((t) => t.parentUid === formState.task!.uid)
      : false

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-[#1a1a1a]">
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
        onStartChange={handleStartChange}
        onFinishChange={handleFinishChange}
      />
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
          predecessorOptions={predecessorOptions}
          hasChildren={formHasChildren}
          onSubmit={handleFormSubmit}
          onDelete={formState.mode === 'edit' ? handleDeleteTask : undefined}
          onClose={closeForm}
        />
      )}
    </div>
  )
}
