import { useRef, useState } from 'react'

// Общий хук для триггера попапа: ref на кнопку + anchor-прямоугольник,
// открытие берёт getBoundingClientRect() в момент клика (не при каждом
// рендере) — тот же паттерн, что был независимо продублирован в
// DatePickerPopover/PredecessorPicker/EmployeeSelector триггерах.
export function usePopoverAnchor<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  return {
    ref,
    anchor,
    open: () => setAnchor(ref.current!.getBoundingClientRect()),
    close: () => setAnchor(null),
  }
}
