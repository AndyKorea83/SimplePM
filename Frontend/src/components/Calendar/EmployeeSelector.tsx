import chevronDownIcon from '../../assets/icons/chevron-down.svg'

export const ALL_EMPLOYEES_VALUE = 'all'

type EmployeeOption = { uid: number; name: string }

type EmployeeSelectorProps = {
  employees: EmployeeOption[]
  value: number | typeof ALL_EMPLOYEES_VALUE
  onChange: (value: number | typeof ALL_EMPLOYEES_VALUE) => void
}

export function EmployeeSelector({ employees, value, onChange }: EmployeeSelectorProps) {
  return (
    <div className="relative flex h-7 w-[200px] shrink-0 items-center rounded border border-[#e0e3eb] bg-white px-[10px] py-[6px]">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === ALL_EMPLOYEES_VALUE ? ALL_EMPLOYEES_VALUE : Number(e.target.value))}
        className="w-full cursor-pointer appearance-none bg-transparent text-[13px] font-semibold text-[#0f1729] outline-none"
      >
        <option value={ALL_EMPLOYEES_VALUE}>Все сотрудники</option>
        {employees.map((employee) => (
          <option key={employee.uid} value={employee.uid}>
            {employee.name}
          </option>
        ))}
      </select>
      <img src={chevronDownIcon} alt="" className="pointer-events-none absolute right-[10px] h-[5px] w-[10px]" />
    </div>
  )
}
