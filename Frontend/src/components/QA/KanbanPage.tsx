import { useEffect, useState } from 'react'
import { PageShell } from '../ui/PageShell'
import { QaSectionHeader } from './QaSectionHeader'
import { KanbanColumn } from './KanbanColumn'
import { BugHistoryModal } from './BugHistoryModal'
import { fetchKanban, updateBugStatus } from './api'
import type { KanbanColumnDTO } from './types'

// Колонка "blocked-paused" — не значение статуса на бэкенде (см.
// KanbanColumn.tsx), поэтому здесь нет для неё записи: перетаскивание
// в/из неё не поддерживается.
const STATUS_BY_COLUMN_KEY: Record<string, string> = {
  'to-do': 'To Do',
  'in-progress': 'In Progress',
  'ready-for-qa': 'Ready for QA',
  'qa-in-progress': 'QA in progress',
}

type KanbanPageProps = {
  // Явный проп, а не жёстко зашитое поведение — эта же доска (с другими
  // колонками) понадобится ещё в одном разделе, и там перетаскивание может
  // быть нужно или не нужно независимо от QA.
  allowDragAndDrop: boolean
}

export function KanbanPage({ allowDragAndDrop }: KanbanPageProps) {
  const [columns, setColumns] = useState<KanbanColumnDTO[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historyBugUid, setHistoryBugUid] = useState<number | null>(null)

  const refetch = () => fetchKanban().then(setColumns).catch((err: Error) => setError(err.message))

  useEffect(() => {
    refetch()
  }, [])

  const handleDropBug = async (columnKey: string, bugUid: number) => {
    const status = STATUS_BY_COLUMN_KEY[columnKey]
    if (!status) return
    try {
      await updateBugStatus(bugUid, status)
      await refetch()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <PageShell>
      <QaSectionHeader />
      <div className="min-h-0 flex-1 overflow-x-auto p-4">
        {error && <p className="text-[14px] text-[#d93333]">Не удалось загрузить доску: {error}</p>}
        {!error && !columns && <p className="text-[14px] text-[#94a3b8]">Загрузка…</p>}
        {columns && (
          <div className="flex h-full gap-3">
            {columns.map((column) => (
              <KanbanColumn
                key={column.key}
                column={column}
                acceptsDrop={allowDragAndDrop && column.key !== 'blocked-paused'}
                onCardClick={setHistoryBugUid}
                onDropBug={(bugUid) => handleDropBug(column.key, bugUid)}
              />
            ))}
          </div>
        )}
      </div>
      {historyBugUid !== null && <BugHistoryModal bugUid={historyBugUid} onClose={() => setHistoryBugUid(null)} />}
    </PageShell>
  )
}
