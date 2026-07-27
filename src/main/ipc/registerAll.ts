import { registerAuthHandlers } from './auth'
import { registerEmployeeHandlers } from './employees'
import { registerAttendanceHandlers } from './attendance'
import { registerPayrollHandlers } from './payroll'
import { registerProductionHandlers } from './production'
import { registerKilnHandlers } from './kilns'
import { registerInventoryHandlers } from './inventory'
import { registerSupplierHandlers } from './suppliers'
import { registerReconciliationHandlers } from './reconciliation'
import { registerCustomerHandlers } from './customers'
import { registerOrderHandlers } from './orders'
import { registerPriceCatalogueHandlers } from './priceCatalogue'
import { registerInvoiceHandlers } from './invoices'
import { registerProformaHandlers } from './proformas'
import { registerPaymentHandlers } from './payments'
import { registerDeliveryHandlers } from './deliveries'
import { registerExpenseHandlers } from './expenses'
import { registerExpenseCategoryHandlers } from './expenseCategories'
import { registerMaterialCategoryHandlers } from './materialCategories'
import { registerReportHandlers } from './reports'
import { registerDashboardHandlers } from './dashboard'
import { registerSettingsHandlers } from './settings'
import { registerAuditHandlers } from './audit'
import { registerNotificationHandlers } from './notifications'
import { registerImportHandlers } from './import'
import { registerDialogHandlers } from './dialogs'

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
  registerCustomerHandlers()
  registerOrderHandlers()
  registerPriceCatalogueHandlers()
  registerInvoiceHandlers()
  registerProformaHandlers()
  registerPaymentHandlers()
  registerDeliveryHandlers()
  registerExpenseHandlers()
  registerExpenseCategoryHandlers()
  registerMaterialCategoryHandlers()
  registerReportHandlers()
  registerDashboardHandlers()
  registerSettingsHandlers()
  registerAuditHandlers()
  registerNotificationHandlers()
  registerImportHandlers()
  registerDialogHandlers()
}
