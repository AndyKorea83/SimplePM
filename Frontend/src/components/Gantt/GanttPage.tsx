import { useEffect, useMemo, useState } from 'react'
import { fetchProject } from './api'
import { buildTaskTree, filterTaskTree } from './buildTaskTree'
import { formatDateRange } from './dateGrid'
import { BottomStatusBar } from './BottomStatusBar'
import { GanttHeader } from './GanttHeader'
import { GanttWorkspace } from './GanttWorkspace'
import { deriveStatus, type TaskStatus } from './status'
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

  const setScale = (next: GanttScale) => {
    localStorage.setItem(SCALE_STORAGE_KEY, next)
    setScaleState(next)
  }
  const setDensity = (next: GanttDensity) => {
    localStorage.setItem(DENSITY_STORAGE_KEY, next)
    setDensityState(next)
  }

  useEffect(() => {
    fetchProject()
      .then(setProject)
      .catch((err: Error) => setError(err.message))
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
    </div>
  )
}
