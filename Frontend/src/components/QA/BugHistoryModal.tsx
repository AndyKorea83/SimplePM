import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { fetchBugHistory } from './api'
import { statusPillColor } from './qaColors'
import { Pill } from './Pill'
import type { BugHistoryViewDTO } from './types'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const LABEL_EVENT_COLOR = { bg: '#e52626', text: '#ffffff' }

type BugHistoryModalProps = {
  bugUid: number
  onClose: () => void
}

// Открывается по клику на баг — и с Kanban-доски, и из отчёта по багам
// (см. Kanban/BugReport — оба просто передают bugUid).
export function BugHistoryModal({ bugUid, onClose }: BugHistoryModalProps) {
  const [view, setView] = useState<BugHistoryViewDTO | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setView(null)
    setError(null)
    fetchBugHistory(bugUid)
      .then(setView)
      .catch((err: Error) => setError(err.message))
  }, [bugUid])

  return (
    <Modal widthClassName="w-[480px]">
      <h2 className="text-[18px] font-bold text-[var(--text-primary)]">История смены статуса</h2>

      {view && (
        <p className="border-b border-[var(--border)] pb-4 text-[13px] font-medium text-[#2563eb]">
          #{view.bug.uid} {view.bug.title}
        </p>
      )}

      {error && <p className="text-[13px] text-[#d93333]">Не удалось загрузить историю: {error}</p>}
      {!view && !error && <p className="text-[13px] text-[var(--text-secondary)]">Загрузка…</p>}

      {view && (
        <div className="relative flex max-h-[360px] w-full flex-col gap-4 overflow-y-auto py-2">
          <div className="absolute bottom-2 left-[104px] top-2 w-px bg-[var(--border)]" />
          {view.entries.map((entry, i) => (
            <div key={i} className="flex w-full gap-4">
              <div className="flex w-[100px] shrink-0 flex-col items-end text-right">
                <span className="text-[12px] text-[var(--text-primary)]">{formatDateTime(entry.at)}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">{entry.byName}</span>
              </div>
              <div className="relative flex flex-1 flex-wrap items-center gap-1.5 pl-4">
                <span className="absolute left-0 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[var(--border)]" />
                {entry.kind === 'status' ? (
                  <>
                    <Pill color={statusPillColor(entry.fromStatus || 'Created')}>{entry.fromStatus || 'Created'}</Pill>
                    <span className="text-[10px] text-[var(--text-secondary)]">→</span>
                    <Pill color={statusPillColor(entry.toStatus ?? '')}>{entry.toStatus}</Pill>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {entry.kind === 'label_added' ? 'Добавлена метка' : 'Снята метка'}
                    </span>
                    <Pill color={LABEL_EVENT_COLOR}>{entry.label}</Pill>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex w-full items-center justify-between border-t border-[var(--border)] pt-4">
        <div className="text-[12px] text-[var(--text-secondary)]">
          <p>Всего изменений: {view?.totalChanges ?? '—'}</p>
          <p>
            Время жизни задачи: {view ? `${view.lifetimeDays} дн. ${view.lifetimeHours} ч.` : '—'}
          </p>
        </div>
        <Button variant="primary" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </Modal>
  )
}
