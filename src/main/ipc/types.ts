export type Role = 'ADMIN' | 'PRODUCTION_SUPERVISOR' | 'SALES_OFFICER' | 'STORE_MANAGER' | 'ACCOUNTANT'

export type IpcResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string }

export interface SessionInfo {
  userId: string
  email: string
  role: Role
}
