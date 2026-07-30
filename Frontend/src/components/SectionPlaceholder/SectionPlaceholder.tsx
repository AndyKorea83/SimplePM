type SectionPlaceholderProps = {
  title: string
}

export function SectionPlaceholder({ title }: SectionPlaceholderProps) {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <p className="text-[15px] text-[#475569] dark:text-[#80808c]">Раздел «{title}» в разработке</p>
    </div>
  )
}
