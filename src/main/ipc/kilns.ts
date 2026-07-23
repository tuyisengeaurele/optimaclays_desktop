import type { Kiln, KilnStatus, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

type KilnWithCount = Prisma.KilnGetPayload<{ include: { _count: { select: { batches: true } } } }>

interface CreateKilnPayload {
  name: string
  capacity?: number
  status?: KilnStatus
  last_service_date?: string | null
  notes?: string | null
}

interface UpdateKilnPayload {
  id: string
  name?: string
  capacity?: number
  status?: KilnStatus
  last_service_date?: string | null
  notes?: string | null
}

interface DeleteKilnPayload {
  id: string
}

export function registerKilnHandlers(): void {
  handle<void, KilnWithCount[]>('kilns:list', null, async () =>
    prisma.kiln.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { batches: true } } }
    })
  )

  handle<CreateKilnPayload, Kiln>('kilns:create', ['ADMIN', 'PRODUCTION_SUPERVISOR'], async ({ name, capacity, status, last_service_date, notes }) => {
    if (!name?.trim()) throw new BadRequestError('name is required')
    return prisma.kiln.create({
      data: {
        name: name.trim(),
        capacity: Number(capacity) || 0,
        status: status || 'ACTIVE',
        last_service_date: last_service_date ? new Date(last_service_date) : null,
        notes: notes || null
      }
    })
  })

  handle<UpdateKilnPayload, Kiln>(
    'kilns:update',
    ['ADMIN', 'PRODUCTION_SUPERVISOR'],
    async ({ id, name, capacity, status, last_service_date, notes }) => {
      const kiln = await prisma.kiln.findUnique({ where: { id } })
      if (!kiln) throw new NotFoundError('Kiln not found')
      return prisma.kiln.update({
        where: { id },
        data: {
          name: name?.trim() || undefined,
          capacity: capacity != null ? Number(capacity) : undefined,
          status: status || undefined,
          last_service_date: last_service_date ? new Date(last_service_date) : undefined,
          notes: notes !== undefined ? notes || null : undefined
        }
      })
    }
  )

  handle<DeleteKilnPayload, { deleted: boolean }>('kilns:delete', ['ADMIN'], async ({ id }) => {
    const kiln = await prisma.kiln.findUnique({ where: { id } })
    if (!kiln) throw new NotFoundError('Kiln not found')
    const batchCount = await prisma.productionBatch.count({ where: { kilnId: id } })
    if (batchCount > 0) throw new BadRequestError('Cannot delete kiln with existing production batches')
    await prisma.kiln.delete({ where: { id } })
    return { deleted: true }
  })
}
