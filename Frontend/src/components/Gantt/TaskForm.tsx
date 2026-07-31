import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { DEPENDENCY_TYPE_OPTIONS } from './types'
import { PredecessorPicker } from './PredecessorPicker'

export type TaskFormValues = {
  name: string
  parentUid: number | null
  start: string
  finish: string
  percentComplete: number
  isBlocked: boolean
  assigneeResourceUids: number[]
  dependencies: { predecessorUid: number; type: number }[]
}

type TaskFormProps = {
  mode: 'create' | 'edit'
  initialValues: TaskFormValues
  parentOptions: { uid: number; label: string }[]
  resourceOptions: { uid: number; name: string }[]
  predecessorOptions: { uid: number; label: string }[]
  hasChildren: boolean
  // Группа: % выполнения считается backend'ом по подзадачам и не
  // редактируется вручную (см. memstore.recomputeSummaryProgress).
  isSummary: boolean
  onSubmit: (values: TaskFormValues) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] text-[var(--text-secondary)]">
      {label}
      {children}
    </label>
  )
}

const inputClass =
  'rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text-primary)] dark:bg-[#1c1c1e]'

export function TaskForm({
  mode,
  initialValues,
  parentOptions,
  resourceOptions,
  predecessorOptions,
  hasChildren,
  isSummary,
  onSubmit,
  onDelete,
  onClose,
}: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addPredecessorRef = useRef<HTMLButtonElement>(null)
  const [predecessorAnchor, setPredecessorAnchor] = useState<DOMRect | null>(null)

  const toggleAssignee = (uid: number) => {
    setValues((prev) => ({
      ...prev,
      assigneeResourceUids: prev.assigneeResourceUids.includes(uid)
        ? prev.assigneeResourceUids.filter((id) => id !== uid)
        : [...prev.assigneeResourceUids, uid],
    }))
  }

  const addDependency = (predecessorUid: number) => {
    setValues((prev) => ({
      ...prev,
      dependencies: [...prev.dependencies, { predecessorUid, type: 1 }],
    }))
  }

  const removeDependency = (predecessorUid: number) => {
    setValues((prev) => ({
      ...prev,
      dependencies: prev.dependencies.filter((d) => d.predecessorUid !== predecessorUid),
    }))
  }

  const changeDependencyType = (predecessorUid: number, type: number) => {
    setValues((prev) => ({
      ...prev,
      dependencies: prev.dependencies.map((d) => (d.predecessorUid === predecessorUid ? { ...d, type } : d)),
    }))
  }

  const availablePredecessors = predecessorOptions.filter(
    (option) => !values.dependencies.some((d) => d.predecessorUid === option.uid),
  )
  const predecessorLabel = (uid: number) => predecessorOptions.find((o) => o.uid === uid)?.label ?? `#${uid}`

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    const message = hasChildren
      ? 'Удалить задачу вместе со всеми подзадачами? Это действие нельзя отменить.'
      : 'Удалить задачу? Это действие нельзя отменить.'
    if (!window.confirm(message)) return
    setSaving(true)
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="flex w-[420px] max-h-[90vh] flex-col gap-4 overflow-y-auto rounded-lg bg-[var(--surface)] p-6 shadow-xl"
      >
        <h2 className="text-[16px] font-bold text-[var(--text-primary)]">
          {mode === 'create' ? 'Новая задача' : 'Редактирование задачи'}
        </h2>

        <Field label="Название">
          <input
            required
            className={inputClass}
            value={values.name}
            onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
          />
        </Field>

        <Field label="Родительская задача">
          <select
            className={inputClass}
            value={values.parentUid ?? 'none'}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, parentUid: e.target.value === 'none' ? null : Number(e.target.value) }))
            }
          >
            <option value="none">Без родителя</option>
            {parentOptions.map((option) => (
              <option key={option.uid} value={option.uid}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex gap-3">
          <Field label="Начало">
            <input
              required
              type="date"
              className={inputClass}
              value={values.start}
              onChange={(e) => setValues((prev) => ({ ...prev, start: e.target.value }))}
            />
          </Field>
          <Field label="Окончание">
            <input
              required
              type="date"
              className={inputClass}
              value={values.finish}
              onChange={(e) => setValues((prev) => ({ ...prev, finish: e.target.value }))}
            />
          </Field>
        </div>

        {isSummary ? (
          <Field label="% выполнения">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[#94a3b8]"
                  style={{ width: `${values.percentComplete}%` }}
                />
              </div>
              <span className="shrink-0 text-[13px] text-[var(--text-secondary)]">
                {values.percentComplete}%
              </span>
            </div>
            <span className="text-[12px] text-[var(--text-secondary)]">
              Считается автоматически по подзадачам
            </span>
          </Field>
        ) : (
          <Field label={`% выполнения: ${values.percentComplete}%`}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={values.percentComplete}
              onChange={(e) => setValues((prev) => ({ ...prev, percentComplete: Number(e.target.value) }))}
              className="w-full cursor-pointer accent-[#4078d9]"
            />
          </Field>
        )}

        <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={values.isBlocked}
            onChange={(e) => setValues((prev) => ({ ...prev, isBlocked: e.target.checked }))}
          />
          Заблокирована
        </label>

        <Field label="Исполнители">
          <div className="flex max-h-[140px] flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
            {resourceOptions.map((resource) => (
              <label key={resource.uid} className="flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={values.assigneeResourceUids.includes(resource.uid)}
                  onChange={() => toggleAssignee(resource.uid)}
                />
                {resource.name}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Предшественники">
          <div className="flex flex-col gap-1">
            {values.dependencies.map((dep) => (
              <div key={dep.predecessorUid} className="flex items-center gap-2">
                <span className="flex-1 truncate text-[13px] text-[var(--text-primary)]">
                  {predecessorLabel(dep.predecessorUid)}
                </span>
                <select
                  className={`${inputClass} !py-1`}
                  value={dep.type}
                  onChange={(e) => changeDependencyType(dep.predecessorUid, Number(e.target.value))}
                >
                  {DEPENDENCY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeDependency(dep.predecessorUid)}
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
        </Field>
        {predecessorAnchor && (
          <PredecessorPicker
            options={availablePredecessors}
            anchorRect={predecessorAnchor}
            onSelect={addDependency}
            onClose={() => setPredecessorAnchor(null)}
          />
        )}

        {error && <p className="text-[13px] text-[#d93333]">{error}</p>}

        <div className="flex items-center justify-between gap-2 pt-2">
          {mode === 'edit' && onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="cursor-pointer rounded-lg border border-[#d93333] px-3 py-2 text-[13px] font-medium text-[#d93333] disabled:opacity-50"
            >
              Удалить
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-medium text-[var(--text-secondary)] disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer rounded-lg bg-[#4078d9] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
