import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'danger' | 'secondary' | 'success' | 'ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-[#4078d9] text-white',
  danger: 'border border-[#d93333] text-[#d93333]',
  secondary: 'border border-[var(--border)] text-[var(--text-secondary)]',
  success: 'bg-[#2e8f57] text-white',
  // ghost — без принудительного padding и текстового цвета: у вызывающих
  // реально разные отступы и цвет текста (нав-стрелки — text-secondary,
  // пункты списка предшественника — text-primary), общий только hover.
  // Цвет текста caller обязан передать через className сам — если
  // положить его сюда, конфликтующий класс из className может проиграть
  // по порядку в итоговом CSS (Tailwind не гарантирует порядок по JSX).
  ghost: 'hover:bg-[#f2f5f7] dark:hover:bg-[#1c1c1e]',
}

// База — общая для 4 "полноразмерных" вариантов; ghost её не использует,
// т.к. у него нет единого размера (см. VARIANT_CLASS).
const BASE_CLASS = 'flex cursor-pointer items-center gap-[6px] rounded-lg px-3 py-2 text-[13px] font-medium disabled:opacity-50'

// forwardRef — DependenciesField кладёт ref на кнопку-триггер попапа
// (usePopoverAnchor читает getBoundingClientRect() с неё).
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', className, type = 'button', ...props },
  ref,
) {
  const variantClass = VARIANT_CLASS[variant]
  const base = variant === 'ghost' ? 'cursor-pointer rounded' : BASE_CLASS
  return <button ref={ref} type={type} className={`${base} ${variantClass} ${className ?? ''}`} {...props} />
})
