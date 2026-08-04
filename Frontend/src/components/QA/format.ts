// "Александр Стребков" -> "А. Стребков" — карточки Kanban и таблица отчёта
// показывают исполнителя в этом сокращённом виде (см. Figma).
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return fullName
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

export function formatDate(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}
