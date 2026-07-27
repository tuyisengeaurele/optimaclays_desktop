// Every page in this app was written against an axios client that wrapped
// responses as { data: { success, message, data } }, with `data: any`
// throughout (same loose typing as the original app's api.ts). Rather than
// touch the data-access line in every page, callIpc() reproduces that same
// shape and looseness on top of window.api.invoke(), which already resolves
// straight to the unwrapped result. Pages keep working as
// `someApi.thing().then(r => r.data.data)`.
interface Envelope<T = any> {
  data: {
    success: true
    message: string
    data: T
  }
}

async function callIpc<T = any>(channel: string, payload: unknown = {}): Promise<Envelope<T>> {
  const data = await window.api.invoke<unknown, T>(channel, payload)
  return { data: { success: true, message: 'Success', data } }
}

export const authApi = {
  login: async (data: { email: string; password: string }): Promise<Envelope<{ token: string; user: any }>> => {
    const result = await window.api.invokePublic<typeof data, { token: string; user: any }>('auth:login', data)
    window.api.setToken(result.token)
    return { data: { success: true, message: 'Success', data: result } }
  },
  logout: async (): Promise<Envelope<null>> => {
    const token = window.api.getToken()
    await window.api.invokePublic('auth:logout', { token })
    window.api.setToken(null)
    return { data: { success: true, message: 'Success', data: null } }
  },
  getProfile: () => callIpc('auth:profile'),
  changePassword: (data: { currentPassword: string; newPassword: string }) => callIpc('auth:changePassword', data),
  updateProfile: (data: { full_name?: string; email?: string }) => callIpc('auth:updateProfile', data),
  listUsers: () => callIpc('auth:listUsers'),
  createUser: (data: unknown) => callIpc('auth:createUser', data),
  updateUser: (id: string, data: object) => callIpc('auth:updateUser', { id, ...data })
}

export const employeeApi = {
  list: () => callIpc('employees:list'),
  get: (id: string) => callIpc('employees:get', { id }),
  create: (data: unknown) => callIpc('employees:create', data),
  update: (id: string, data: object) => callIpc('employees:update', { id, ...data }),
  delete: (id: string) => callIpc('employees:delete', { id })
}

export const payrollApi = {
  list: () => callIpc('payroll:list'),
  get: (runId: string) => callIpc('payroll:get', { runId }),
  create: (data: { month: number; year: number }) => callIpc('payroll:create', data),
  updateEntry: (runId: string, entryId: string, data: object) => callIpc('payroll:updateEntry', { runId, entryId, ...data }),
  markAllPaid: (runId: string) => callIpc('payroll:markAllPaid', { runId }),
  finalize: (runId: string) => callIpc('payroll:finalize', { runId }),
  delete: (runId: string) => callIpc('payroll:delete', { runId }),
  export: (runId: string) => saveBufferViaDialog('payroll:export', { runId }, 'Payroll'),
  downloadPayslip: (runId: string, employeeId: string) => downloadPdfViaDialog('payroll:payslip', { runId, employeeId }, 'Payslips')
}

export const attendanceApi = {
  list: (params?: object) => callIpc('attendance:list', params || {}),
  create: (data: unknown) => callIpc('attendance:create', data),
  update: (id: string, data: object) => callIpc('attendance:update', { id, ...data }),
  summary: (params: object) => callIpc('attendance:summary', params)
}

export const productionApi = {
  list: (params?: object) => callIpc('production:list', params || {}),
  stats: () => callIpc('production:stats'),
  create: (data: unknown) => callIpc('production:create', data),
  update: (id: string, data: object) => callIpc('production:update', { id, ...data }),
  complete: (id: string, data: object) => callIpc('production:complete', { id, ...data }),
  delete: (id: string) => callIpc('production:delete', { id })
}

export const kilnApi = {
  list: () => callIpc('kilns:list'),
  create: (data: unknown) => callIpc('kilns:create', data),
  update: (id: string, data: object) => callIpc('kilns:update', { id, ...data }),
  delete: (id: string) => callIpc('kilns:delete', { id })
}

export const inventoryApi = {
  listRaw: () => callIpc('inventory:listRawMaterials'),
  addRaw: (data: unknown) => callIpc('inventory:addRawMaterial', data),
  consume: (data: unknown) => callIpc('inventory:consumeRawMaterial', data),
  listFinished: () => callIpc('inventory:listFinishedGoods'),
  addFinished: (data: unknown) => callIpc('inventory:addFinishedGoods', data),
  setThreshold: (data: unknown) => callIpc('inventory:setThreshold', data)
}

export const supplierApi = {
  list: () => callIpc('suppliers:list'),
  create: (data: unknown) => callIpc('suppliers:create', data),
  update: (id: string, data: object) => callIpc('suppliers:update', { id, ...data }),
  delete: (id: string) => callIpc('suppliers:delete', { id })
}

export const reconciliationApi = {
  list: () => callIpc('reconciliation:list'),
  get: (id: string) => callIpc('reconciliation:get', { id }),
  create: (data: unknown) => callIpc('reconciliation:create', data)
}

export const customerApi = {
  list: () => callIpc('customers:list'),
  get: (id: string) => callIpc('customers:get', { id }),
  create: (data: unknown) => callIpc('customers:create', data),
  update: (id: string, data: object) => callIpc('customers:update', { id, ...data }),
  delete: (id: string) => callIpc('customers:delete', { id })
}

export const orderApi = {
  list: () => callIpc('orders:list'),
  get: (id: string) => callIpc('orders:get', { id }),
  create: (data: unknown) => callIpc('orders:create', data),
  update: (id: string, data: object) => callIpc('orders:update', { id, ...data }),
  updateStatus: (id: string, data: object) => callIpc('orders:updateStatus', { id, ...data }),
  delete: (id: string) => callIpc('orders:delete', { id }),
  getStatement: (customerId: string) => callIpc('orders:customerStatement', { customerId })
}

export const priceCatalogueApi = {
  list: () => callIpc('priceCatalogue:list'),
  upsert: (data: unknown) => callIpc('priceCatalogue:upsert', data),
  delete: (id: string) => callIpc('priceCatalogue:delete', { id })
}

export const proformaApi = {
  list: () => callIpc('proformas:list'),
  create: (data: {
    customerId?: string
    orderId?: string
    brick_type?: string
    custom_name?: string
    quantity?: number
    unit_price?: number
    notes?: string
    valid_until?: string
    payment_terms?: string
    delivery_period?: string
  }) => callIpc('proformas:create', data),
  get: (id: string) => callIpc('proformas:get', { id }),
  delete: (id: string) => callIpc('proformas:delete', { id }),
  downloadPdf: (id: string) => downloadPdfViaDialog('proformas:pdf', { id }, 'Proformas')
}

export const invoiceApi = {
  list: () => callIpc('invoices:list'),
  get: (id: string) => callIpc('invoices:get', { id }),
  create: (data: unknown) => callIpc('invoices:create', data),
  delete: (id: string) => callIpc('invoices:delete', { id }),
  downloadPdf: (id: string) => downloadPdfViaDialog('invoices:pdf', { id }, 'Invoices')
}

export const paymentApi = {
  list: (params?: object) => callIpc('payments:list', params || {}),
  create: (data: unknown) => callIpc('payments:create', data)
}

export const deliveryApi = {
  list: (params?: object) => callIpc('deliveries:list', params || {}),
  create: (data: unknown) => callIpc('deliveries:create', data),
  updateStatus: (id: string, data: object) => callIpc('deliveries:updateStatus', { id, ...data }),
  recordDamage: (id: string, data: object) => callIpc('deliveries:recordDamage', { id, ...data }),
  delete: (id: string) => callIpc('deliveries:delete', { id }),
  downloadWaybillPdf: (id: string) => downloadPdfViaDialog('deliveries:waybill', { id }, 'Waybills')
}

export const expenseApi = {
  list: (params?: object) => callIpc('expenses:list', params || {}),
  create: (data: unknown) => callIpc('expenses:create', data),
  delete: (id: string) => callIpc('expenses:delete', { id })
}

export const expenseCategoryApi = {
  list: () => callIpc('expenseCategories:list'),
  create: (data: { name: string }) => callIpc('expenseCategories:create', data),
  update: (id: string, data: object) => callIpc('expenseCategories:update', { id, ...data }),
  delete: (id: string) => callIpc('expenseCategories:delete', { id })
}

export const materialCategoryApi = {
  list: () => callIpc('materialCategories:list'),
  create: (data: { name: string }) => callIpc('materialCategories:create', data),
  update: (id: string, data: object) => callIpc('materialCategories:update', { id, ...data }),
  delete: (id: string) => callIpc('materialCategories:delete', { id })
}

export const reportApi = {
  production: (params?: object) => callIpc('reports:production', params || {}),
  sales: (params?: object) => callIpc('reports:sales', params || {}),
  payroll: (params?: object) => callIpc('reports:payroll', params || {}),
  financials: (params?: object) => callIpc('reports:financials', params || {}),
  exportInvoices: (params?: object) => saveBufferViaDialog('reports:exportInvoices', params || {}, 'Reports'),
  exportExpenses: (params?: object) => saveBufferViaDialog('reports:exportExpenses', params || {}, 'Reports')
}

export const dashboardApi = {
  get: () => callIpc('dashboard:get')
}

export const settingsApi = {
  getCompany: () => callIpc('settings:getCompany'),
  updateCompany: (data: unknown) => callIpc('settings:updateCompany', data),
  getPinnedKpis: () => callIpc('settings:getPinnedKpis'),
  updatePinnedKpis: (pinned_kpis: string[]) => callIpc('settings:updatePinnedKpis', { pinned_kpis })
}

export const auditApi = {
  list: (params?: object) => callIpc('audit:list', params || {})
}

export const notificationApi = {
  get: () => callIpc('notifications:list'),
  markRead: (ids: string[] | 'all') => callIpc('notifications:markRead', { ids }),
  generate: () => callIpc('notifications:generate')
}

export const importApi = {
  customers: (filePath: string) => callIpc('import:customers', { filePath }),
  employees: (filePath: string) => callIpc('import:employees', { filePath })
}

// Payslip/proforma/waybill handlers return { html, filename } instead of PDF
// bytes. This turns that HTML into a real PDF and hands it to a native save
// dialog, defaulting to a per-document-type folder under the user's own
// Documents folder.
async function downloadPdfViaDialog(channel: string, payload: unknown, category: string): Promise<void> {
  const result = await window.api.invoke<unknown, { html: string; filename: string }>(channel, payload)
  await window.api.invoke('dialogs:downloadPdf', { ...result, category })
}

// xlsx/CSV export handlers return a base64 buffer instead of streaming an
// HTTP response. This hands it to a native save dialog instead, defaulting
// to a per-document-type folder under the user's own Documents folder.
async function saveBufferViaDialog(channel: string, payload: unknown, category: string): Promise<void> {
  const result = await window.api.invoke<unknown, { buffer: string; filename: string }>(channel, payload)
  await window.api.invoke('dialogs:saveBuffer', { ...result, category })
}
