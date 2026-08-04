import { useEffect, useState } from 'react'
import { PageShell } from '../ui/PageShell'
import { QaSectionHeader } from './QaSectionHeader'
import { BugHistoryModal } from './BugHistoryModal'
import { Pill } from './Pill'
import { fetchBugReport } from './api'
import { SEVERITY_COLORS, PRIORITY_COLORS, LABEL_COLORS } from './qaColors'
import { formatDate } from './format'
import type { BugDTO, PersonBugsDTO } from './types'

function BugRow({ bug, index, onClick }: { bug: BugDTO; index: number; onClick: () => void }) {
  return (
    <tr className={index % 2 === 1 ? 'bg-[#f8fafc] dark:bg-[#1c1c1e]' : 'bg-[var(--surface)]'}>
      <td className="border-b border-[var(--border)] px-4 py-1.5 align-top">
        <button
          type="button"
          onClick={onClick}
          className="cursor-pointer text-left text-[14px] font-semibold text-[#2563eb] underline"
        >
          #{bug.uid} {bug.title}
        </button>
        <p className="text-[11px] text-[var(--text-secondary)]">{bug.theme}</p>
      </td>
      <td className="border-b border-[var(--border)] px-4 py-1.5 align-top text-[12px] font-semibold text-[var(--text-primary)]">
        {bug.status}
      </td>
      <td className="border-b border-[var(--border)] px-4 py-1.5 align-top">
        <Pill color={SEVERITY_COLORS[bug.severity] ?? SEVERITY_COLORS.minor}>{bug.severity}</Pill>
      </td>
      <td className="border-b border-[var(--border)] px-4 py-1.5 align-top">
        <Pill color={PRIORITY_COLORS[bug.priority] ?? PRIORITY_COLORS.Normal}>{bug.priority}</Pill>
      </td>
      <td className="border-b border-[var(--border)] px-4 py-1.5 align-top">
        {bug.isBlocked && <Pill color={LABEL_COLORS.blocked}>blocked</Pill>}
        {bug.isPaused && <Pill color={LABEL_COLORS.paused}>paused</Pill>}
      </td>
      <td className="border-b border-[var(--border)] px-4 py-1.5 align-top text-[13px] text-[var(--text-primary)]">
        {bug.deadline ? formatDate(bug.deadline) : <span className="text-[#94a3b8]">-</span>}
      </td>
    </tr>
  )
}

function PersonSection({ group, onBugClick }: { group: PersonBugsDTO; onBugClick: (uid: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[16px] font-bold text-[var(--text-primary)]">{group.assigneeName}</p>
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f1f5f9] text-left text-[12px] font-bold text-[#475569] dark:bg-[#1c1c1e]">
              <th className="w-[340px] px-4 py-1.5">Задача</th>
              <th className="w-[120px] px-4 py-1.5">Статус</th>
              <th className="w-[110px] px-4 py-1.5">Критичность</th>
              <th className="w-[110px] px-4 py-1.5">Важность</th>
              <th className="w-[120px] px-4 py-1.5">Blocked/Paused</th>
              <th className="w-[120px] px-4 py-1.5">Дедлайн</th>
            </tr>
          </thead>
          <tbody>
            {group.bugs.map((bug, i) => (
              <BugRow key={bug.uid} bug={bug} index={i} onClick={() => onBugClick(bug.uid)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function BugReportPage() {
  const [groups, setGroups] = useState<PersonBugsDTO[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historyBugUid, setHistoryBugUid] = useState<number | null>(null)

  useEffect(() => {
    fetchBugReport().then(setGroups).catch((err: Error) => setError(err.message))
  }, [])

  return (
    <PageShell>
      <QaSectionHeader />
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
        {error && <p className="text-[14px] text-[#d93333]">Не удалось загрузить отчёт: {error}</p>}
        {!error && !groups && <p className="text-[14px] text-[#94a3b8]">Загрузка…</p>}
        {groups?.map((group) => (
          <PersonSection key={group.assigneeName} group={group} onBugClick={setHistoryBugUid} />
        ))}
      </div>
      {historyBugUid !== null && <BugHistoryModal bugUid={historyBugUid} onClose={() => setHistoryBugUid(null)} />}
    </PageShell>
  )
}
