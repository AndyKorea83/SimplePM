import { useState, type FormEvent } from 'react'
import { formatDayMonth } from './dateGrid'
import { DependenciesField } from './DependenciesField'
import { Field, inputClass } from './FormField'

export type GroupFormValues = {
  name: string
  parentUid: number | null
  dependencies: { predecessorUid: number; type: number }[]
}

type GroupFormProps = {
  initialValues: GroupFormValues
  start: string
  finish: string
  percentComplete: number
  assigneeNames: string[]
  hasBlockedDescendant: boolean
  parentOptions: { uid: number; label: string }[]
  predecessorOptions: { uid: number; label: string }[]
  onSubmit: (values: GroupFormValues) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

// Отдельная форма для групповых (summary) задач — в отличие от TaskForm:
// даты только на просмотр (группа берёт диапазон от подзадач, вручную не
// переносится), "Заблокирована" не редактируется точечно — вместо чекбокса
// предупреждение, если среди подзадач есть заблокированные, а исполнители —
// просто список тех, кто назначен на вложенные задачи (не мультиселект).
export function GroupForm({
  initialValues,
  start,
  finish,
  percentComplete,
  assigneeNames,
  hasBlockedDescendant,
  parentOptions,
  predecessorOptions,
  onSubmit,
  onDelete,
  onClose,
}: GroupFormProps) {
  const [values, setValues] = useState<GroupFormValues>(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!window.confirm('Удалить группу вместе со всеми подзадачами? Это действие нельзя отменить.')) return
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
        <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Группа задач</h2>

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
            <p className={`${inputClass} !border-transparent !bg-transparent !px-0 dark:!bg-transparent`}>
              {formatDayMonth(new Date(start))}
            </p>
          </Field>
          <Field label="Окончание">
            <p className={`${inputClass} !border-transparent !bg-transparent !px-0 dark:!bg-transparent`}>
              {formatDayMonth(new Date(finish))}
            </p>
          </Field>
        </div>

        <Field label="% выполнения">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
              <div className="h-full rounded-full bg-[#94a3b8]" style={{ width: `${percentComplete}%` }} />
            </div>
            <span className="shrink-0 text-[13px] text-[var(--text-secondary)]">{percentComplete}%</span>
          </div>
          <span className="text-[12px] text-[var(--text-secondary)]">Считается автоматически по подзадачам</span>
        </Field>

        {hasBlockedDescendant && (
          <p className="rounded-lg bg-[#d93333]/10 px-3 py-2 text-[13px] text-[#d93333]">
            Внутри группы есть заблокированные задачи
          </p>
        )}

        <Field label="Исполнители">
          <p className="text-[13px] text-[var(--text-primary)]">
            {assigneeNames.length > 0 ? assigneeNames.join(', ') : 'Нет назначенных исполнителей'}
          </p>
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
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="cursor-pointer rounded-lg border border-[#d93333] px-3 py-2 text-[13px] font-medium text-[#d93333] disabled:opacity-50"
          >
            Удалить
          </button>
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
