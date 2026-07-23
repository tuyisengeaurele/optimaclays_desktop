import type { BrickType, PriceCatalogue } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

interface UpsertPricePayload {
  brick_type: BrickType
  unit_price: number | string
  is_active?: boolean
}

interface DeletePricePayload {
  id: string
}

export function registerPriceCatalogueHandlers(): void {
  handle<void, PriceCatalogue[]>('priceCatalogue:list', null, async () =>
    prisma.priceCatalogue.findMany({ orderBy: { brick_type: 'asc' } })
  )

  handle<UpsertPricePayload, PriceCatalogue>('priceCatalogue:upsert', ['ADMIN'], async ({ brick_type, unit_price, is_active }) => {
    if (!brick_type) throw new BadRequestError('brick_type is required')
    if (unit_price == null || isNaN(Number(unit_price)) || Number(unit_price) < 0) {
      throw new BadRequestError('unit_price must be a non-negative number')
    }
    return prisma.priceCatalogue.upsert({
      where: { brick_type },
      update: { unit_price: Number(unit_price), is_active: is_active !== undefined ? Boolean(is_active) : undefined },
      create: { brick_type, unit_price: Number(unit_price), is_active: is_active !== false }
    })
  })

  handle<DeletePricePayload, { deleted: boolean }>('priceCatalogue:delete', ['ADMIN'], async ({ id }) => {
    const price = await prisma.priceCatalogue.findUnique({ where: { id } })
    if (!price) throw new NotFoundError('Price entry not found')
    await prisma.priceCatalogue.delete({ where: { id } })
    return { deleted: true }
  })
}
