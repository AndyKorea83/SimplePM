type SectionPlaceholderProps = {
  title: string
}

export function SectionPlaceholder({ title }: SectionPlaceholderProps) {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <p className="text-[15px] text-[var(--text-secondary)]">Раздел «{title}» в разработке</p>
    </div>
  )
}
