import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

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

// Общая "рамка поля" — border/bg/radius/padding без текстовых стилей.
// Нужна отдельно от inputClass для элементов, которые визуально выглядят
// как поле ввода, но не являются <input>/<select> (например "фейковые
// поля" в GanttHeader — диапазон дат, кнопка настроек).
export const fieldSurfaceClass = 'rounded-lg border border-[var(--border)] bg-white px-3 py-2 dark:bg-[#1c1c1e]'

export const inputClass = `${fieldSurfaceClass} text-[13px] text-[var(--text-primary)]`

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return <input className={`${inputClass} ${className ?? ''}`} {...rest} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props
  return <select className={`cursor-pointer font-medium ${inputClass} ${className ?? ''}`} {...rest} />
}
