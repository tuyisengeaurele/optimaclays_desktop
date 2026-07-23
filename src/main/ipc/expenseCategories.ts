import type { ExpenseCategoryConfig } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

const DEFAULT_CATEGORIES = [
  { name: 'Maintenance', sort_order: 0 },
  { name: 'Utilities', sort_order: 1 },
  { name: 'Transport', sort_order: 2 },
  { name: 'Raw Materials', sort_order: 3 },
  { name: 'Labour', sort_order: 4 },
  { name: 'Equipment', sort_order: 5 },
  { name: 'Administration', sort_order: 6 },
  { name: 'Other', sort_order: 7 }
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

export function registerExpenseCategoryHandlers(): void {
  handle<void, ExpenseCategoryConfig[]>('expenseCategories:list', null, async () => {
    let categories = await prisma.expenseCategoryConfig.findMany({ orderBy: { sort_order: 'asc' } })
    if (categories.length === 0) {
      // SQLite's createMany doesn't support skipDuplicates (Prisma limitation), but this
      // only runs when the table is empty, so there's nothing to collide with.
      await prisma.expenseCategoryConfig.createMany({ data: DEFAULT_CATEGORIES })
      categories = await prisma.expenseCategoryConfig.findMany({ orderBy: { sort_order: 'asc' } })
    }
    return categories
  })

  handle<CreateCategoryPayload, ExpenseCategoryConfig>('expenseCategories:create', ['ADMIN', 'ACCOUNTANT'], async ({ name }) => {
    if (!name?.trim()) throw new BadRequestError('name is required')
    const exists = await prisma.expenseCategoryConfig.findUnique({ where: { name: name.trim() } })
    if (exists) throw new BadRequestError('Category with this name already exists')
    const maxOrder = await prisma.expenseCategoryConfig.aggregate({ _max: { sort_order: true } })
    return prisma.expenseCategoryConfig.create({
      data: { name: name.trim(), sort_order: (maxOrder._max.sort_order ?? -1) + 1 }
    })
  })

  handle<UpdateCategoryPayload, ExpenseCategoryConfig>('expenseCategories:update', ['ADMIN', 'ACCOUNTANT'], async ({ id, name, is_active }) => {
    const category = await prisma.expenseCategoryConfig.findUnique({ where: { id } })
    if (!category) throw new NotFoundError('Category not found')
    if (name?.trim()) {
      const exists = await prisma.expenseCategoryConfig.findFirst({ where: { name: name.trim(), NOT: { id } } })
      if (exists) throw new BadRequestError('Category with this name already exists')
    }
    return prisma.expenseCategoryConfig.update({
      where: { id },
      data: {
        name: name?.trim() || undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : undefined
      }
    })
  })

  handle<DeleteCategoryPayload, { deleted: boolean }>('expenseCategories:delete', ['ADMIN'], async ({ id }) => {
    const category = await prisma.expenseCategoryConfig.findUnique({ where: { id } })
    if (!category) throw new NotFoundError('Category not found')
    const inUse = await prisma.expense.count({ where: { category: category.name } })
    if (inUse > 0) throw new BadRequestError(`Cannot delete: ${inUse} expense(s) use this category`)
    await prisma.expenseCategoryConfig.delete({ where: { id } })
    return { deleted: true }
  })
}
