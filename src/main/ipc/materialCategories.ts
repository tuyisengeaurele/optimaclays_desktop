import type { MaterialCategoryConfig } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

const DEFAULT_CATEGORIES = [
  { name: 'Clay', sort_order: 0 },
  { name: 'Sand', sort_order: 1 },
  { name: 'Firewood', sort_order: 2 },
  { name: 'Coal', sort_order: 3 },
  { name: 'Diesel', sort_order: 4 },
  { name: 'Cement', sort_order: 5 },
  { name: 'Other', sort_order: 6 }
]

interface CreateCategoryPayload {
  name: string
}

interface UpdateCategoryPayload {
  id: string
  name?: string
  is_active?: boolean
}

interface DeleteCategoryPayload {
  id: string
}

export function registerMaterialCategoryHandlers(): void {
  handle<void, MaterialCategoryConfig[]>('materialCategories:list', null, async () => {
    let categories = await prisma.materialCategoryConfig.findMany({ orderBy: { sort_order: 'asc' } })
    if (categories.length === 0) {
      // Same SQLite createMany/skipDuplicates limitation as expenseCategories - only
      // runs against an empty table, so there's nothing to collide with.
      await prisma.materialCategoryConfig.createMany({ data: DEFAULT_CATEGORIES })
      categories = await prisma.materialCategoryConfig.findMany({ orderBy: { sort_order: 'asc' } })
    }
    return categories
  })

  handle<CreateCategoryPayload, MaterialCategoryConfig>(
    'materialCategories:create',
    ['ADMIN', 'STORE_MANAGER'],
    async ({ name }) => {
      if (!name?.trim()) throw new BadRequestError('name is required')
      const exists = await prisma.materialCategoryConfig.findUnique({ where: { name: name.trim() } })
      if (exists) throw new BadRequestError('Material with this name already exists')
      const maxOrder = await prisma.materialCategoryConfig.aggregate({ _max: { sort_order: true } })
      return prisma.materialCategoryConfig.create({
        data: { name: name.trim(), sort_order: (maxOrder._max.sort_order ?? -1) + 1 }
      })
    },
    { resource: 'material_category', action: 'CREATE' }
  )

  handle<UpdateCategoryPayload, MaterialCategoryConfig>(
    'materialCategories:update',
    ['ADMIN', 'STORE_MANAGER'],
    async ({ id, name, is_active }) => {
      const category = await prisma.materialCategoryConfig.findUnique({ where: { id } })
      if (!category) throw new NotFoundError('Material not found')
      if (name?.trim()) {
        const exists = await prisma.materialCategoryConfig.findFirst({ where: { name: name.trim(), NOT: { id } } })
        if (exists) throw new BadRequestError('Material with this name already exists')
      }
      return prisma.materialCategoryConfig.update({
        where: { id },
        data: {
          name: name?.trim() || undefined,
          is_active: is_active !== undefined ? Boolean(is_active) : undefined
        }
      })
    },
    { resource: 'material_category', action: 'UPDATE' }
  )

  handle<DeleteCategoryPayload, { deleted: boolean }>(
    'materialCategories:delete',
    ['ADMIN'],
    async ({ id }) => {
      const category = await prisma.materialCategoryConfig.findUnique({ where: { id } })
      if (!category) throw new NotFoundError('Material not found')
      const inUse = await prisma.supplierMaterialType.count({ where: { materialType: category.name } })
      if (inUse > 0) throw new BadRequestError(`Cannot delete: ${inUse} supplier(s) are tagged with this material`)
      await prisma.materialCategoryConfig.delete({ where: { id } })
      return { deleted: true }
    },
    { resource: 'material_category', action: 'DELETE' }
  )
}
