export type TimesheetTaskDTO = {
  uid: number
  name: string
  dailyHours: number[]
}

export type TimesheetThemeDTO = {
  uid: number
  name: string
  dailyTotals: number[]
  tasks: TimesheetTaskDTO[]
}

export type TimesheetEmployeeDTO = {
  uid: number
  name: string
  team: string
  dailyTotals: number[]
  totalHours: number
  themes: TimesheetThemeDTO[]
}

export type TimesheetMonthDTO = {
  year: number
  month: number
  daysInMonth: number
  employees: TimesheetEmployeeDTO[]
}
