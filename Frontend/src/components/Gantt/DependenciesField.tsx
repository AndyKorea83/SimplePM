import { useRef, useState } from 'react'
import { Field, inputClass } from './FormField'
import { PredecessorPicker } from './PredecessorPicker'
import { DEPENDENCY_TYPE_OPTIONS } from './types'

type Dependency = { predecessorUid: number; type: number }

type DependenciesFieldProps = {
  dependencies: Dependency[]
  predecessorOptions: { uid: number; label: string }[]
  onAdd: (predecessorUid: number) => void
  onRemove: (predecessorUid: number) => void
  onChangeType: (predecessorUid: number, type: number) => void
}

// Общий блок "Предшественники" — переиспользуется формой задачи и формой
// группы (TaskForm.tsx, GroupForm.tsx): список текущих связей + попап выбора
// новой (см. PredecessorPicker, тот же паттерн, что и у DatePickerPopover).
export function DependenciesField({
  dependencies,
  predecessorOptions,
  onAdd,
  onRemove,
  onChangeType,
}: DependenciesFieldProps) {
  const addPredecessorRef = useRef<HTMLButtonElement>(null)
  const [predecessorAnchor, setPredecessorAnchor] = useState<DOMRect | null>(null)

  const availablePredecessors = predecessorOptions.filter(
    (option) => !dependencies.some((d) => d.predecessorUid === option.uid),
  )
  const predecessorLabel = (uid: number) => predecessorOptions.find((o) => o.uid === uid)?.label ?? `#${uid}`

  return (
    <Field label="Предшественники">
      <div className="flex flex-col gap-1">
        {dependencies.map((dep) => (
          <div key={dep.predecessorUid} className="flex items-center gap-2">
            <span className="flex-1 truncate text-[13px] text-[var(--text-primary)]">
              {predecessorLabel(dep.predecessorUid)}
            </span>
            <select
              className={`${inputClass} !py-1`}
              value={dep.type}
              onChange={(e) => onChangeType(dep.predecessorUid, Number(e.target.value))}
            >
              {DEPENDENCY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onRemove(dep.predecessorUid)}
              className="cursor-pointer rounded px-2 py-1 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--border)]"
            >
              ×
            </button>
          </div>
        ))}
        <button
          ref={addPredecessorRef}
          type="button"
          onClick={() => setPredecessorAnchor(addPredecessorRef.current!.getBoundingClientRect())}
          className="-mx-2 self-start rounded px-2 py-1 text-left text-[13px] text-[#4078d9] hover:bg-[var(--border)]"
        >
          + Добавить предшественника
        </button>
      </div>
      {predecessorAnchor && (
        <PredecessorPicker
          options={availablePredecessors}
          anchorRect={predecessorAnchor}
          onSelect={onAdd}
          onClose={() => setPredecessorAnchor(null)}
        />
      )}
    </Field>
  )
}
