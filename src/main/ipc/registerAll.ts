import { registerAuthHandlers } from './auth'
import { registerEmployeeHandlers } from './employees'
import { registerAttendanceHandlers } from './attendance'
import { registerPayrollHandlers } from './payroll'
import { registerProductionHandlers } from './production'
import { registerKilnHandlers } from './kilns'
import { registerInventoryHandlers } from './inventory'
import { registerSupplierHandlers } from './suppliers'
import { registerReconciliationHandlers } from './reconciliation'

export function registerAllHandlers(): void {
  registerAuthHandlers()
  registerEmployeeHandlers()
  registerAttendanceHandlers()
  registerPayrollHandlers()
  registerProductionHandlers()
  registerKilnHandlers()
  registerInventoryHandlers()
  registerSupplierHandlers()
  registerReconciliationHandlers()
}
