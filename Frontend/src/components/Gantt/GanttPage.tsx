import { useEffect, useMemo, useState } from 'react'
import { PageShell } from '../ui/PageShell'
import { createTask, deleteTask, fetchProject, updateTask } from './api'
import { buildTaskTree, filterTaskTree, flattenVisible } from './buildTaskTree'
import { formatDateRange } from './dateGrid'
import { BottomStatusBar } from './BottomStatusBar'
import { GanttHeader } from './GanttHeader'
import { GanttWorkspace } from './GanttWorkspace'
import { GroupForm, type GroupFormValues } from './GroupForm'
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

  // Для формы группы (GroupForm): исполнители — не редактируемый мультиселект,
  // а список тех, кто назначен на вложенные (любой глубины) задачи; и флаг
  // "внутри есть заблокированная задача" — вместо точечного чекбокса группы.
  const groupInfoByTaskUid = useMemo(() => {
    const map = new Map<number, { assigneeNames: string[]; hasBlockedDescendant: boolean }>()
    if (!project) return map
    const childrenByParent = new Map<number, number[]>()
    for (const t of project.tasks) {
      if (t.parentUid == null) continue
      const arr = childrenByParent.get(t.parentUid) ?? []
      arr.push(t.uid)
      childrenByParent.set(t.parentUid, arr)
    }
    const nameByResourceUid = new Map(project.resources.map((r) => [r.uid, r.name]))
    const isBlockedByUid = new Map(project.tasks.map((t) => [t.uid, t.isBlocked]))
    for (const summary of project.tasks) {
      if (!summary.isSummary) continue
      const descendantUids = new Set<number>()
      const queue = [...(childrenByParent.get(summary.uid) ?? [])]
      while (queue.length > 0) {
        const uid = queue.shift()!
        if (descendantUids.has(uid)) continue
        descendantUids.add(uid)
        queue.push(...(childrenByParent.get(uid) ?? []))
      }
      const assigneeNames = new Set<string>()
      let hasBlockedDescendant = false
      for (const uid of descendantUids) {
        if (isBlockedByUid.get(uid)) hasBlockedDescendant = true
        for (const resourceUid of resourceUidsByTaskUid.get(uid) ?? []) {
          const name = nameByResourceUid.get(resourceUid)
          if (name) assigneeNames.add(name)
        }
      }
      map.set(summary.uid, { assigneeNames: [...assigneeNames].sort(), hasBlockedDescendant })
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
        // Веха выставляется только импортом из MSPDI — форма создания
        // задачи её больше не предлагает.
        isMilestone: false,
        isBlocked: values.isBlocked,
        assigneeResourceUids: values.assigneeResourceUids,
        dependencies: values.dependencies,
      })
    } else if (formState?.task) {
      // TaskForm теперь используется только для не-групповых задач (группы
      // редактируются через GroupForm) — percentComplete всегда безопасно
      // отправлять, серверная валидация групп сюда не попадает.
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

  // Группа: редактируются только название и предшественники — даты берутся
  // от подзадач, % и "заблокировано" не редактируются (см. GroupForm).
  const handleGroupFormSubmit = async (values: GroupFormValues) => {
    if (!formState?.task) return
    await updateTask(formState.task.uid, {
      name: values.name,
      dependencies: values.dependencies,
    })
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

  // Клик по линии связи на диаграмме и последующее удаление (issue #39) —
  // убираем одну запись из dependencies преемника и шлём весь список целиком
  // (тот же паттерн полной замены, что и у assigneeResourceUids).
  const handleDeleteDependency = async (successorUid: number, predecessorUid: number, type: number) => {
    const successor = project?.tasks.find((t) => t.uid === successorUid)
    if (!successor) return
    const nextDependencies = (successor.dependencies ?? []).filter(
      (d) => !(d.predecessorUid === predecessorUid && d.type === type),
    )
    try {
      await updateTask(successorUid, { dependencies: nextDependencies })
      await refetch()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  // Перетаскивание ручки соединения от одного бара до другого (см.
  // GanttWorkspace.handleLinkDragStart) — создаёт связь ОН (самый частый
  // тип) от задачи, откуда потянули, к той, куда отпустили. Ошибки backend'а
  // (цикл, дубль, несуществующий предшественник) всплывают как alert — тем
  // же способом, что и остальные мутации на этой странице.
  const handleCreateDependency = async (predecessorUid: number, successorUid: number) => {
    const successor = project?.tasks.find((t) => t.uid === successorUid)
    if (!successor) return
    const existing = successor.dependencies ?? []
    if (existing.some((d) => d.predecessorUid === predecessorUid)) return
    try {
      await updateTask(successorUid, { dependencies: [...existing, { predecessorUid, type: 1 }] })
      await refetch()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--surface)]">
        <p className="text-[14px] text-[#d93333]">Не удалось загрузить проект: {error}</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--surface)]">
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
            isBlocked: false,
            assigneeResourceUids: [],
            dependencies: [],
          }

  const formHasChildren =
    formState?.mode === 'edit' && formState.task
      ? project.tasks.some((t) => t.parentUid === formState.task!.uid)
      : false

  // Группа редактируется отдельной формой (GroupForm) — см. её собственный
  // комментарий о том, чем она отличается от TaskForm.
  const isEditingGroup = formState?.mode === 'edit' && !!formState.task?.isSummary

  const groupFormInitialValues: GroupFormValues | null =
    isEditingGroup && formState?.task
      ? {
          name: formState.task.name,
          parentUid: formState.task.parentUid ?? null,
          dependencies: (formState.task.dependencies ?? []).map((d) => ({
            predecessorUid: d.predecessorUid,
            type: d.type,
          })),
        }
      : null
  const groupInfo = isEditingGroup && formState?.task ? groupInfoByTaskUid.get(formState.task.uid) : undefined

  return (
    <PageShell>
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
        onDeleteDependency={handleDeleteDependency}
        onCreateDependency={handleCreateDependency}
      />
      <BottomStatusBar
        totalTasks={totalTasks}
        completedPercent={completedPercent}
        teamInitials={teamMembers.map((m) => m.initials)}
        statusCounts={statusCounts}
        activeStatuses={activeStatuses}
        onToggleStatus={toggleStatusFilter}
      />
      {isEditingGroup && groupFormInitialValues && formState?.task && (
        <GroupForm
          initialValues={groupFormInitialValues}
          start={formState.task.start}
          finish={formState.task.finish}
          percentComplete={formState.task.percentComplete}
          assigneeNames={groupInfo?.assigneeNames ?? []}
          hasBlockedDescendant={groupInfo?.hasBlockedDescendant ?? false}
          parentOptions={parentOptions}
          predecessorOptions={predecessorOptions}
          onSubmit={handleGroupFormSubmit}
          onDelete={handleDeleteTask}
          onClose={closeForm}
        />
      )}
      {formState && !isEditingGroup && formInitialValues && (
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
    </PageShell>
  )
}
