import { useState, type FormEvent } from 'react'
import { DependenciesField } from './DependenciesField'
import { Field, inputClass } from './FormField'

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
  onSubmit: (values: TaskFormValues) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export function TaskForm({
  mode,
  initialValues,
  parentOptions,
  resourceOptions,
  predecessorOptions,
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

        <DependenciesField
          dependencies={values.dependencies}
          predecessorOptions={predecessorOptions}
          onAdd={addDependency}
          onRemove={removeDependency}
          onChangeType={changeDependencyType}
        />

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
