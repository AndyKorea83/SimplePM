import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Field, inputClass } from '../ui/Input'

export type ProjectFormValues = {
  name: string
  description: string
}

type ProjectFormProps = {
  mode: 'create' | 'edit'
  initialValues: ProjectFormValues
  onSubmit: (values: ProjectFormValues) => Promise<void>
  onClose: () => void
}

// Даты/счётчики задач — вычисляются из задач проекта, не редактируются
// напрямую (тот же принцип, что и у GroupForm для сумма-задач). Удаления
// проекта здесь нет — сознательно не запрошено (см. architect.md).
export function ProjectForm({ mode, initialValues, onSubmit, onClose }: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <Modal>
      <form onSubmit={handleSubmit} className="contents">
        <h2 className="text-[16px] font-bold text-[var(--text-primary)]">
          {mode === 'create' ? 'Новый проект' : 'Редактирование проекта'}
        </h2>

        <Field label="Название">
          <input
            required
            className={inputClass}
            value={values.name}
            onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
          />
        </Field>

        <Field label="Описание">
          <textarea
            rows={3}
            className={`${inputClass} resize-none`}
            value={values.description}
            onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
          />
        </Field>

        {error && <p className="text-[13px] text-[#d93333]">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  )
}
