import type { Payment, PaymentMethod } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'
import { computeIsOverdue } from './invoices'

interface ListPaymentsPayload {
  invoiceId?: string
}

interface CreatePaymentPayload {
  invoiceId: string
  amount: number | string
  date?: string
  method: PaymentMethod
  reference?: string | null
  notes?: string | null
}

export function registerPaymentHandlers(): void {
  handle<ListPaymentsPayload, Payment[]>('payments:list', null, async ({ invoiceId }) =>
    prisma.payment.findMany({
      where: invoiceId ? { invoiceId } : {},
      orderBy: { date: 'desc' }
    })
  )

  handle<CreatePaymentPayload, Payment>(
    'payments:create',
    null,
    async ({ invoiceId, amount, date, method, reference, notes }) => {
      if (!invoiceId) throw new BadRequestError('invoiceId is required')
      if (!method) throw new BadRequestError('method is required')
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        throw new BadRequestError('amount must be a positive number')
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true }
      })
      if (!invoice) throw new NotFoundError('Invoice not found')

      const alreadyPaid = invoice.payments.reduce((s, p) => s + p.amount, 0)
      const balance = invoice.total - alreadyPaid

      if (Number(amount) > balance + 0.01) {
        throw new BadRequestError(`Payment of ${Number(amount).toLocaleString()} exceeds the outstanding balance of ${balance.toLocaleString()} RWF`)
      }

      const newTotalPaid = alreadyPaid + Number(amount)
      const isOverdue = computeIsOverdue(invoice, newTotalPaid)

      // Recording the payment and refreshing the invoice's overdue flag must succeed or
      // fail together, otherwise a payment could be recorded while the invoice's stored
      // is_overdue flag silently drifts out of sync.
      return prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            invoiceId,
            amount: Number(amount),
            date: date ? new Date(date) : new Date(),
            method,
            reference: reference || null,
            notes: notes || null
          }
        })
        await tx.invoice.update({ where: { id: invoiceId }, data: { is_overdue: isOverdue } })
        return payment
      })
    },
    { resource: 'payment', action: 'CREATE' }
  )
}
