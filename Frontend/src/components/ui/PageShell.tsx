import type { ReactNode } from 'react'

// Общая обёртка страницы — переиспользуется во всех разделах
// (Гант/Календарь/Трудозатраты/вкладки), один и тот же литерал классов
// был продублирован в 5 файлах.
export function PageShell({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full flex-col bg-[var(--surface)]">{children}</div>
}
