import type { CSSProperties, ReactNode } from 'react'

type AvatarProps = {
  children: ReactNode
  // Цвет фона — hex или CSS-переменная (var(--border)), поэтому строкой
  // в inline style, а не Tailwind-классом (см. BottomStatusBar — обычный
  // и "+N" аватары используют разные источники цвета).
  color: string
  textClassName?: string
  style?: CSSProperties
}

// Аватар-кружок команды проекта (BottomStatusBar) — переиспользуется для
// инициалов сотрудника и переполнения "+N", отличаются только цветом.
export function Avatar({ children, color, textClassName = 'text-white', style }: AvatarProps) {
  return (
    <div
      className={`flex size-5 items-center justify-center rounded-[5px] border-2 border-white text-[9px] font-medium dark:border-[#111111] ${textClassName}`}
      style={{ backgroundColor: color, ...style }}
    >
      {children}
    </div>
  )
}
