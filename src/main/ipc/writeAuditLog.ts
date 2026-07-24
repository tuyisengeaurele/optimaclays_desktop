import { prisma } from '../db'
import type { SessionInfo } from './types'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

export interface AuditDescriptor {
  resource: string
  action: AuditAction
}

function extractResourceId(payload: unknown, result: unknown): string | null {
  const payloadId = (payload as { id?: string } | null)?.id
  if (payloadId) return payloadId
  const resultId = (result as { id?: string } | null)?.id
  return resultId ?? null
}

const SENSITIVE_KEYS = ['password', 'currentPassword', 'newPassword']

// Payloads for user/password handlers carry plaintext credentials. The audit
// trail is meant to record what changed, not store passwords in the clear,
// so those fields are masked before the row is written.
function redactSensitive(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  const redacted: Record<string, unknown> = { ...(payload as Record<string, unknown>) }
  for (const key of SENSITIVE_KEYS) {
    if (key in redacted) redacted[key] = '[redacted]'
  }
  return redacted
}

// Ported from the source project's backend/src/middleware/audit.ts, which
// wrote one AuditLog row per successful mutating request via Express
// middleware. There's no HTTP layer here, so this gets called directly from
// handle() after a mutating handler's function resolves successfully.
export async function writeAuditLog(
  session: SessionInfo,
  descriptor: AuditDescriptor,
  payload: unknown,
  result: unknown
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: session.userId,
        user_name: session.email,
        action: descriptor.action,
        resource: descriptor.resource,
        resource_id: extractResourceId(payload, result),
        new_values: descriptor.action !== 'DELETE' ? (redactSensitive(payload) as object) : undefined,
        ip_address: null
      }
    })
  } catch {
    // Matches source: an audit-write failure must never break the real mutation.
  }
}
