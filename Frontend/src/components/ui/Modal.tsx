import type { ReactNode } from 'react'

type ModalProps = {
  children: ReactNode
  // Ширина панели переопределяется вызывающим — сама Modal не диктует
  // размер контента, только backdrop и общую "рамку" панели.
  widthClassName?: string
}

// Закрытие только явными кнопками формы (Отмена/×), как было раньше —
// клик по фону/Escape намеренно не добавлены (не было и в исходных
// TaskForm/GroupForm, это отдельное UX-решение, не побочный эффект рефакторинга).
export function Modal({ children, widthClassName = 'w-[420px]' }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`flex max-h-[90vh] flex-col gap-4 overflow-y-auto rounded-lg bg-[var(--surface)] p-6 shadow-xl ${widthClassName}`}>
        {children}
      </div>
    </div>
  )
}
