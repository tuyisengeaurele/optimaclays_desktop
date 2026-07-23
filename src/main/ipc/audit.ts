import type { AuditLog, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'

interface ListAuditLogsPayload {
  resource?: string
  user_id?: string
  from?: string
  to?: string
  page?: number | string
  limit?: number | string
}

interface ListAuditLogsResult {
  logs: AuditLog[]
  total: number
  page: number
  limit: number
}

export function registerAuditHandlers(): void {
  handle<ListAuditLogsPayload, ListAuditLogsResult>(
    'audit:list',
    ['ADMIN'],
    async ({ resource, user_id, from, to, page = 1, limit = 50 }) => {
      const where: Prisma.AuditLogWhereInput = {}
      if (resource) where.resource = resource
      if (user_id) where.user_id = user_id
      if (from || to) {
        where.createdAt = {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {})
        }
      }
      const pageNum = Number(page) || 1
      const limitNum = Number(limit) || 50
      const skip = (pageNum - 1) * limitNum
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limitNum }),
        prisma.auditLog.count({ where })
      ])
      return { logs, total, page: pageNum, limit: limitNum }
    }
  )
}
