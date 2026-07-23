import { registerAuthHandlers } from './auth'
import { registerEmployeeHandlers } from './employees'
import { registerAttendanceHandlers } from './attendance'
import { registerPayrollHandlers } from './payroll'

export function registerAllHandlers(): void {
  registerAuthHandlers()
  registerEmployeeHandlers()
  registerAttendanceHandlers()
  registerPayrollHandlers()
}
