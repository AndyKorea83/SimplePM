import { useState, type FormEvent, type ReactNode } from 'react'

export type TaskFormValues = {
  name: string
  parentUid: number | null
  start: string
  finish: string
  percentComplete: number
  isMilestone: boolean
  isBlocked: boolean
  assigneeResourceUids: number[]
}

type TaskFormProps = {
  mode: 'create' | 'edit'
  initialValues: TaskFormValues
  parentOptions: { uid: number; label: string }[]
  resourceOptions: { uid: number; name: string }[]
  hasChildren: boolean
  onSubmit: (values: TaskFormValues) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] text-[#475569] dark:text-[#80808c]">
      {label}
      {children}
    </label>
  )
}

const inputClass =
  'rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#0f172a] dark:border-[#27272a] dark:bg-[#1c1c1e] dark:text-[#f2f2f7]'

export function TaskForm({
  mode,
  initialValues,
  parentOptions,
  resourceOptions,
  hasChildren,
  onSubmit,
  onDelete,
  onClose,
}: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleAssignee = (uid: number) => {
    setValues((prev) => ({
      ...prev,
      assigneeResourceUids: prev.assigneeResourceUids.includes(uid)
        ? prev.assigneeResourceUids.filter((id) => id !== uid)
        : [...prev.assigneeResourceUids, uid],
    }))
  }

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
        className="flex w-[420px] max-h-[90vh] flex-col gap-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-[#1a1a1a]"
      >
        <h2 className="text-[16px] font-bold text-[#0f172a] dark:text-[#f2f2f7]">
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

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-[13px] text-[#475569] dark:text-[#80808c]">
            <input
              type="checkbox"
              checked={values.isMilestone}
              onChange={(e) => setValues((prev) => ({ ...prev, isMilestone: e.target.checked }))}
            />
            Веха
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[#475569] dark:text-[#80808c]">
            <input
              type="checkbox"
              checked={values.isBlocked}
              onChange={(e) => setValues((prev) => ({ ...prev, isBlocked: e.target.checked }))}
            />
            Заблокирована
          </label>
        </div>

        <Field label="Исполнители">
          <div className="flex max-h-[140px] flex-col gap-1 overflow-y-auto rounded-lg border border-[#e2e8f0] p-2 dark:border-[#27272a]">
            {resourceOptions.map((resource) => (
              <label key={resource.uid} className="flex items-center gap-2 text-[13px] text-[#0f172a] dark:text-[#f2f2f7]">
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
              className="cursor-pointer rounded-lg border border-[#e2e8f0] px-3 py-2 text-[13px] font-medium text-[#475569] disabled:opacity-50 dark:border-[#27272a] dark:text-[#80808c]"
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
