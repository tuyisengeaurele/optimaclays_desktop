import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

type InvoiceWithDetail = Prisma.InvoiceGetPayload<{
  include: { order: { include: { customer: true } }; items: true; payments: true }
}>
type InvoiceWithComputed = InvoiceWithDetail & { paid: number; balance: number; is_overdue: boolean }

interface CreateInvoicePayload {
  orderId: string
  due_date?: string
}

interface GetInvoicePayload {
  id: string
}

interface DeleteInvoicePayload {
  id: string
}

export function computeIsOverdue(invoice: { due_date: Date | null; total: number }, paid: number): boolean {
  if (!invoice.due_date) return false
  return new Date() > invoice.due_date && paid < invoice.total
}

export function registerInvoiceHandlers(): void {
  handle<void, InvoiceWithComputed[]>('invoices:list', null, async () => {
    const invoices = await prisma.invoice.findMany({
      include: { order: { include: { customer: true } }, items: true, payments: true },
      orderBy: { date: 'desc' }
    })
    return invoices.map((inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
      const balance = inv.total - paid
      // Always compute is_overdue dynamically — don't rely on the stored flag
      const is_overdue = computeIsOverdue(inv, paid)
      return { ...inv, paid, balance, is_overdue }
    })
  })

  handle<CreateInvoicePayload, InvoiceWithDetail>(
    'invoices:create',
    null,
    async ({ orderId, due_date }) => {
      if (!orderId) throw new BadRequestError('orderId is required')

      const order = await prisma.order.findFirst({
        where: { id: orderId, deletedAt: null },
        include: { customer: true }
      })
      if (!order) throw new NotFoundError('Order not found')

      const existingInvoice = await prisma.invoice.findFirst({ where: { orderId } })
      if (existingInvoice) throw new BadRequestError(`This order was already invoiced as ${existingInvoice.number}`)

      const year = new Date().getFullYear()
      // Use a transaction so count + create are atomic — prevents duplicate numbers under concurrent calls
      return prisma.$transaction(async (tx) => {
        const count = await tx.invoice.count({ where: { number: { startsWith: `OCL-${year}-` } } })
        const number = `OCL-${year}-${String(count + 1).padStart(3, '0')}`
        return tx.invoice.create({
          data: {
            number,
            orderId,
            due_date: due_date ? new Date(due_date) : undefined,
            subtotal: order.total_amount,
            total: order.total_amount,
            items: {
              create: [
                {
                  description: 'Bricks Supply',
                  brick_type: order.brick_type,
                  quality_grade: order.quality_grade,
                  quantity: order.quantity,
                  unit_price: order.unit_price,
                  total: order.total_amount
                }
              ]
            }
          },
          include: { items: true, order: { include: { customer: true } }, payments: true }
        })
      })
    },
    { resource: 'invoice', action: 'CREATE' }
  )

  handle<GetInvoicePayload, InvoiceWithComputed>('invoices:get', null, async ({ id }) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, order: { include: { customer: true } }, payments: true }
    })
    if (!invoice) throw new NotFoundError('Invoice not found')
    const paid = invoice.payments.reduce((s, p) => s + p.amount, 0)
    const is_overdue = computeIsOverdue(invoice, paid)
    return { ...invoice, paid, balance: invoice.total - paid, is_overdue }
  })

  handle<DeleteInvoicePayload, { deleted: boolean }>(
    'invoices:delete',
    ['ADMIN', 'ACCOUNTANT'],
    async ({ id }) => {
      const invoice = await prisma.invoice.findUnique({ where: { id } })
      if (!invoice) throw new NotFoundError('Invoice not found')
      // Payments and items are child rows with no cascade delete configured on the schema,
      // so they are removed first, then the invoice — all in one transaction so a failure
      // partway through never leaves an orphaned payment/item behind.
      await prisma.$transaction(async (tx) => {
        await tx.payment.deleteMany({ where: { invoiceId: id } })
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
        await tx.invoice.delete({ where: { id } })
      })
      return { deleted: true }
    },
    { resource: 'invoice', action: 'DELETE' }
  )
}
