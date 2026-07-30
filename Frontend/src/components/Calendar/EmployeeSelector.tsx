import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import chevronDownIcon from '../../assets/icons/chevron-down.svg'
import closeLightIcon from '../../assets/icons/close-light.svg'
import closeDarkIcon from '../../assets/icons/close-dark.svg'
import { useTheme } from '../../theme/ThemeContext'

export const ALL_EMPLOYEES_VALUE = 'all'

type EmployeeOption = { uid: number; name: string; team: string }
type EmployeeValue = number | typeof ALL_EMPLOYEES_VALUE

type EmployeeSelectorProps = {
  employees: EmployeeOption[]
  value: EmployeeValue
  onChange: (value: EmployeeValue) => void
}

// Раскладка команд по колонкам — из макета Figma ("Employee Dropdown",
// 164:2864/168:1925, 3-колоночная версия); тот же порядок команд задаёт
// backend-генератор (internal/timesheet/generator.go, issue #45).
const TEAM_COLUMNS = [
  ['Тестирование', 'Embedded-разработка'],
  ['Backend', 'Frontend'],
  ['Мобильная разработка', 'Системный аналитик'],
]

type Section = { team: string; employees: EmployeeOption[] }

function groupByColumns(employees: EmployeeOption[]): Section[][] {
  return TEAM_COLUMNS.map((teams) =>
    teams
      .map((team) => ({ team, employees: employees.filter((e) => e.team === team) }))
      .filter((section) => section.employees.length > 0),
  ).filter((column) => column.length > 0)
}

function EmployeeDropdownPanel({
  employees,
  value,
  anchorRect,
  onChange,
  onClose,
}: {
  employees: EmployeeOption[]
  value: EmployeeValue
  anchorRect: DOMRect
  onChange: (value: EmployeeValue) => void
  onClose: () => void
}) {
  const { theme } = useTheme()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const columns = groupByColumns(employees)

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[100] flex flex-col items-start gap-[10px] rounded-lg border border-[#e0e3eb] bg-white px-4 pb-[14px] pt-[10px] shadow-lg dark:border-[#383d47] dark:bg-[#24262e]"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
    >
      <div className="-mx-2 flex w-[calc(100%+16px)] items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            onChange(ALL_EMPLOYEES_VALUE)
            onClose()
          }}
          className="cursor-pointer rounded px-2 py-1 text-left hover:bg-[#f2f5f7] dark:hover:bg-[#1c1c1e]"
        >
          <p className="text-[13px] font-medium text-[#262933] dark:text-[#e5e5eb]">Все сотрудники</p>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-[#f2f5f7] dark:hover:bg-[#1c1c1e]"
        >
          <img src={theme === 'dark' ? closeDarkIcon : closeLightIcon} alt="Закрыть" className="size-6" />
        </button>
      </div>
      <div className="h-px w-full bg-[#d9dbe0] dark:bg-[rgba(64,66,77,0.5)]" />
      <div className="flex items-start gap-[54px]">
        {columns.map((column, ci) => (
          <div key={ci} className="flex flex-col items-start gap-[2px]">
            {column.map((section, si) => (
              <Fragment key={section.team}>
                <div className={`flex w-full flex-col items-start gap-[6px] pb-2 ${si > 0 ? 'pt-4' : ''}`}>
                  <p className="whitespace-nowrap text-[12px] font-medium text-[#596680] dark:text-[#8c99b2]">
                    {section.team}
                  </p>
                  <div className="h-px w-full bg-[rgba(89,102,128,0.3)] dark:bg-[rgba(140,153,178,0.4)]" />
                </div>
                {section.employees.map((employee) => (
                  <button
                    key={employee.uid}
                    type="button"
                    onClick={() => {
                      onChange(employee.uid)
                      onClose()
                    }}
                    className={`-mx-2 cursor-pointer whitespace-nowrap rounded px-2 py-[5px] text-left text-[13px] hover:bg-[#f2f5f7] dark:hover:bg-[#1c1c1e] ${
                      value === employee.uid ? 'text-[#d9941f]' : 'text-[#262933] dark:text-[#e0e0e5]'
                    }`}
                  >
                    {employee.name}
                  </button>
                ))}
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}

export function EmployeeSelector({ employees, value, onChange }: EmployeeSelectorProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const selectedName =
    value === ALL_EMPLOYEES_VALUE ? 'Все сотрудники' : employees.find((e) => e.uid === value)?.name ?? 'Все сотрудники'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setAnchor(triggerRef.current!.getBoundingClientRect())}
        className="relative flex h-7 w-[200px] shrink-0 cursor-pointer items-center justify-between rounded border border-[#e0e3eb] bg-white px-[10px] py-[6px] dark:border-transparent dark:bg-[#2e303b]"
      >
        <p className="truncate text-[13px] font-semibold text-[#0f1729] dark:text-[#ebedf2]">{selectedName}</p>
        <img src={chevronDownIcon} alt="" className="h-[5px] w-[10px] shrink-0" />
      </button>
      {anchor && (
        <EmployeeDropdownPanel
          employees={employees}
          value={value}
          anchorRect={anchor}
          onChange={onChange}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  )
}
