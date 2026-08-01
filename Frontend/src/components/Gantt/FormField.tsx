import type { ReactNode } from 'react'

// Общая обёртка поля — переиспользуется формой задачи и формой группы
// (TaskForm.tsx, GroupForm.tsx).
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] text-[var(--text-secondary)]">
      {label}
      {children}
    </label>
  )
}

export const inputClass =
  'rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text-primary)] dark:bg-[#1c1c1e]'
