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
        new_values: descriptor.action !== 'DELETE' ? (payload as object) : undefined,
        ip_address: null
      }
    })
  } catch {
    // Matches source: an audit-write failure must never break the real mutation.
  }
}
