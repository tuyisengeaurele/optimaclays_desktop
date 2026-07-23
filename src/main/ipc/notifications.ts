import type { Notification } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'

interface GetNotificationsResult {
  notifications: Notification[]
  unreadCount: number
}

interface MarkReadPayload {
  ids: 'all' | string[]
}

// Ports notificationController.ts's runNotificationChecks: scans for low-stock raw
// materials and newly-overdue invoices, creating a Notification row for each condition
// that doesn't already have an unread notification recorded for it.
async function runNotificationChecks(): Promise<void> {
  const now = new Date()

  const thresholds = await prisma.stockThreshold.findMany()
  for (const threshold of thresholds) {
    const stocks = await prisma.rawMaterialStock.findMany({
      where: { material_type: threshold.material_type }
    })
    const totalQty = stocks.reduce((s, r) => s + r.quantity, 0)
    const consumptions = await prisma.rawMaterialConsumption.findMany({
      where: { material_type: threshold.material_type }
    })
    const totalConsumed = consumptions.reduce((s, r) => s + r.quantity_used, 0)
    const remaining = totalQty - totalConsumed

    if (remaining <= threshold.threshold) {
      const existing = await prisma.notification.findFirst({
        where: {
          type: 'LOW_STOCK',
          resource: threshold.material_type,
          is_read: false,
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }
      })
      if (!existing) {
        await prisma.notification.create({
          data: {
            type: 'LOW_STOCK',
            title: 'Low Stock Alert',
            message: `${threshold.material_type.replace(/_/g, ' ')} is at ${remaining.toFixed(1)} ${threshold.unit}, below the threshold of ${threshold.threshold} ${threshold.unit}`,
            resource: threshold.material_type
          }
        })
      }
    }
  }

  const settings = await prisma.companySettings.findUnique({ where: { id: 'singleton' } })
  const graceDays = settings?.overdue_grace_days ?? 0
  const cutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000)

  const overdueInvoices = await prisma.invoice.findMany({
    where: { due_date: { lt: cutoff }, is_overdue: false },
    include: { payments: true, order: { include: { customer: true } } }
  })

  for (const invoice of overdueInvoices) {
    const paid = invoice.payments.reduce((s, p) => s + p.amount, 0)
    if (paid < invoice.total) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { is_overdue: true } })
      const existing = await prisma.notification.findFirst({
        where: { type: 'OVERDUE_INVOICE', resource_id: invoice.id, is_read: false }
      })
      if (!existing) {
        const customer = invoice.order?.customer
        const name = customer?.company_name || customer?.full_name || 'Unknown'
        await prisma.notification.create({
          data: {
            type: 'OVERDUE_INVOICE',
            title: 'Overdue Invoice',
            message: `Invoice ${invoice.number} for ${name} is overdue`,
            resource: 'invoice',
            resource_id: invoice.id
          }
        })
      }
    }
  }
}

export function registerNotificationHandlers(): void {
  handle<void, GetNotificationsResult>('notifications:list', null, async (_payload, session) => {
    const notifications = await prisma.notification.findMany({
      where: { OR: [{ user_id: session.userId }, { user_id: null }] },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    const unreadCount = notifications.filter((n) => !n.is_read).length
    return { notifications, unreadCount }
  })

  handle<MarkReadPayload, { updated: boolean }>('notifications:markRead', null, async ({ ids }, session) => {
    if (ids === 'all') {
      await prisma.notification.updateMany({
        where: { OR: [{ user_id: session.userId }, { user_id: null }] },
        data: { is_read: true }
      })
    } else if (Array.isArray(ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, OR: [{ user_id: session.userId }, { user_id: null }] },
        data: { is_read: true }
      })
    }
    return { updated: true }
  })

  handle<void, { generated: boolean }>('notifications:generate', null, async () => {
    await runNotificationChecks()
    return { generated: true }
  })
}
