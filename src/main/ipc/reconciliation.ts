import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

type StockReconciliationWithItems = Prisma.StockReconciliationGetPayload<{ include: { items: true } }>

interface ReconciliationItemInput {
  item_type: string
  material_type?: string | null
  brick_type?: string | null
  quality_grade?: string | null
  system_quantity: number
  physical_quantity: number
  notes?: string | null
}

interface GetReconciliationPayload {
  id: string
}

interface CreateReconciliationPayload {
  notes?: string | null
  items: ReconciliationItemInput[]
}

export function registerReconciliationHandlers(): void {
  handle<void, StockReconciliationWithItems[]>('reconciliation:list', null, async () =>
    prisma.stockReconciliation.findMany({
      orderBy: { date: 'desc' },
      include: { items: true },
      take: 50
    })
  )

  handle<GetReconciliationPayload, StockReconciliationWithItems>('reconciliation:get', null, async ({ id }) => {
    const rec = await prisma.stockReconciliation.findUnique({ where: { id }, include: { items: true } })
    if (!rec) throw new NotFoundError('Reconciliation not found')
    return rec
  })

  handle<CreateReconciliationPayload, StockReconciliationWithItems>(
    'reconciliation:create',
    ['ADMIN', 'STORE_MANAGER'],
    async ({ notes, items }, session) => {
      if (!Array.isArray(items) || items.length === 0) throw new BadRequestError('At least one item is required')

      return prisma.stockReconciliation.create({
        data: {
          // Session only carries userId/email/role, not full_name (matching the source's
          // JWT payload shape, which the source comment notes lacks full_name too), so
          // reconciled_by uses the email exactly as the source effectively did.
          reconciled_by: session.email,
          notes: notes || null,
          items: {
            create: items.map((item) => ({
              item_type: item.item_type,
              material_type: item.material_type || null,
              brick_type: item.brick_type || null,
              quality_grade: item.quality_grade || null,
              system_quantity: Number(item.system_quantity),
              physical_quantity: Number(item.physical_quantity),
              variance: Number(item.physical_quantity) - Number(item.system_quantity),
              notes: item.notes || null
            }))
          }
        },
        include: { items: true }
      })
    },
    { resource: 'reconciliation', action: 'CREATE' }
  )
}
