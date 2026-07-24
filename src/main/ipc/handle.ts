import { ipcMain } from 'electron'
import { getSession } from './session'
import { AppError, AuthError, ForbiddenError } from './errors'
import type { IpcResult, Role, SessionInfo } from './types'
import { writeAuditLog, type AuditDescriptor } from './writeAuditLog'

interface Envelope<TPayload> {
  token: string | null
  payload: TPayload
}

async function run<TResult>(channel: string, fn: () => Promise<TResult>): Promise<IpcResult<TResult>> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, code: error.code, message: error.message }
    }
    console.error(`[ipc:${channel}]`, error)
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Something went wrong' }
  }
}

export function handle<TPayload, TResult>(
  channel: string,
  allowedRoles: Role[] | null,
  fn: (payload: TPayload, session: SessionInfo) => Promise<TResult>,
  audit?: AuditDescriptor
): void {
  ipcMain.handle(channel, (_event, envelope: Envelope<TPayload>) =>
    run(channel, async () => {
      const session = getSession(envelope?.token)
      if (!session) throw new AuthError()
      if (allowedRoles && !allowedRoles.includes(session.role)) throw new ForbiddenError()
      const result = await fn(envelope.payload, session)
      if (audit) await writeAuditLog(session, audit, envelope.payload, result)
      return result
    })
  )
}

export function handlePublic<TPayload, TResult>(
  channel: string,
  fn: (payload: TPayload) => Promise<TResult>
): void {
  ipcMain.handle(channel, (_event, payload: TPayload) => run(channel, () => fn(payload)))
}
