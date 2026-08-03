import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Field, inputClass } from '../ui/Input'

export type ImportProjectValues = {
  name: string
  description: string
  file: File
}

type ImportProjectFormProps = {
  onSubmit: (values: ImportProjectValues) => Promise<void>
  onClose: () => void
}

export function ImportProjectForm({ onSubmit, onClose }: ImportProjectFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ name, description, file })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <Modal>
      <form onSubmit={handleSubmit} className="contents">
        <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Импортировать проект</h2>

        <Field label="Название">
          <input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Описание">
          <textarea
            rows={3}
            className={`${inputClass} resize-none`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field label="XML-файл">
          <input
            required
            type="file"
            accept=".xml"
            className={`${inputClass} cursor-pointer`}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>

        {error && <p className="text-[13px] text-[#d93333]">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button variant="primary" type="submit" disabled={saving || !file}>
            Импортировать
          </Button>
        </div>
      </form>
    </Modal>
  )
}
