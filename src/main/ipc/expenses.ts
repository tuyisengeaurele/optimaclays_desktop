import type { Expense, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

interface ListExpensesPayload {
  from?: string
  to?: string
}

interface CreateExpensePayload {
  category: string
  amount: number | string
  date: string
  description?: string | null
}

interface DeleteExpensePayload {
  id: string
}

export function registerExpenseHandlers(): void {
  handle<ListExpensesPayload, Expense[]>('expenses:list', null, async ({ from, to }) => {
    const where: Prisma.ExpenseWhereInput = {}
    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {})
      }
    }
    return prisma.expense.findMany({ where, orderBy: { date: 'desc' } })
  })

  handle<CreateExpensePayload, Expense>('expenses:create', null, async ({ category, amount, date, description }) => {
    if (!category?.trim()) throw new BadRequestError('category is required')
    if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) throw new BadRequestError('amount must be a positive number')
    if (!date) throw new BadRequestError('date is required')

    return prisma.expense.create({
      data: {
        category: category.trim(),
        amount: Number(amount),
        date: new Date(date),
        description: description || null
      }
    })
  })

  handle<DeleteExpensePayload, { deleted: boolean }>('expenses:delete', ['ADMIN', 'ACCOUNTANT'], async ({ id }) => {
    const expense = await prisma.expense.findUnique({ where: { id } })
    if (!expense) throw new NotFoundError('Expense not found')
    await prisma.expense.delete({ where: { id } })
    return { deleted: true }
  })
}
