import type { Prisma, ProductionBatch } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'

// NOTE: the source controller (reportController.ts) does not import fast-csv or
// @fast-csv/format for any of its three export functions - it builds CSV rows by hand with
// plain Array#join(','), and backend/package.json has no CSV-library dependency at all
// (confirmed by grepping the source repo). So no CSV package is added to this project's
// package.json either; the three export handlers below port that same manual row-building
// logic, only swapping the streamed HTTP response for a base64 buffer.

interface DateRangePayload {
  from?: string
  to?: string
}

interface DateRange {
  from: Date
  to: Date
}

function dateRange({ from, to }: DateRangePayload): DateRange {
  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1)
  const toDate = to ? new Date(to) : new Date()
  // A "to" of today's date alone parses as midnight, which would exclude every record
  // from today itself. Extend it to the end of that day so the range actually includes
  // the whole day the caller picked.
  toDate.setHours(23, 59, 59, 999)
  return { from: fromDate, to: toDate }
}

type OrderWithCustomer = Prisma.OrderGetPayload<{ include: { customer: true } }>
type PayrollRunWithEntries = Prisma.PayrollRunGetPayload<{ include: { entries: { include: { employee: true } } } }>
type InvoiceWithOrderAndPayments = Prisma.InvoiceGetPayload<{
  include: { order: { include: { customer: true } }; payments: true }
}>
type PaymentWithInvoiceDetail = Prisma.PaymentGetPayload<{
  include: { invoice: { include: { order: { include: { customer: true } } } } }
}>

interface ProductionReportResult {
  batches: ProductionBatch[]
  totalProduced: number
  totalRejected: number
  rejectionRate: string
}

interface SalesReportResult {
  orders: OrderWithCustomer[]
  totalRevenue: number
}

interface PayrollReportPayload {
  month?: number | string
  year?: number | string
}

interface FinancialReportResult {
  income: number
  expenses: {
    total: number
    manual: number
    rawMaterials: number
    payroll: number
    delivery: number
  }
  profit: number
  expenseBreakdown: Array<{ id: string; category: string; amount: number; date: Date; description: string | null }>
}

interface ExportResult {
  buffer: string
  filename: string
}

function toCsvBase64(rows: string[]): string {
  return Buffer.from(rows.join('\r\n'), 'utf-8').toString('base64')
}

export function registerReportHandlers(): void {
  handle<DateRangePayload, ProductionReportResult>('reports:production', null, async (payload) => {
    const { from, to } = dateRange(payload)
    const batches = await prisma.productionBatch.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' }
    })
    const totalProduced = batches.reduce((s, b) => s + b.bricks_produced, 0)
    const totalRejected = batches.reduce((s, b) => s + b.bricks_rejected, 0)
    const rejectionRate = totalProduced ? ((totalRejected / totalProduced) * 100).toFixed(2) : '0.00'
    return { batches, totalProduced, totalRejected, rejectionRate }
  })

  handle<DateRangePayload, SalesReportResult>('reports:sales', null, async (payload) => {
    const { from, to } = dateRange(payload)
    const orders = await prisma.order.findMany({
      where: { deletedAt: null, order_date: { gte: from, lte: to } },
      include: { customer: true },
      orderBy: { order_date: 'asc' }
    })
    const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0)
    return { orders, totalRevenue }
  })

  handle<PayrollReportPayload, PayrollRunWithEntries[]>('reports:payroll', null, async ({ month, year }) => {
    const where: Prisma.PayrollRunWhereInput = {}
    if (month) where.month = Number(month)
    if (year) where.year = Number(year)

    return prisma.payrollRun.findMany({
      where,
      include: { entries: { include: { employee: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    })
  })

  handle<DateRangePayload, FinancialReportResult>('reports:financials', null, async (payload) => {
    const { from, to } = dateRange(payload)

    const payments = await prisma.payment.findMany({ where: { date: { gte: from, lte: to } } })
    const income = payments.reduce((s, p) => s + p.amount, 0)

    const expenses = await prisma.expense.findMany({ where: { date: { gte: from, lte: to } } })
    const manualExpenses = expenses.reduce((s, e) => s + e.amount, 0)

    const rawMaterials = await prisma.rawMaterialStock.findMany({ where: { date: { gte: from, lte: to } } })
    const rawMaterialCost = rawMaterials.reduce((s, r) => s + r.total_cost, 0)

    const payrollEntries = await prisma.payrollEntry.findMany({
      where: { payment_status: 'PAID', payment_date: { gte: from, lte: to } }
    })
    const payrollCost = payrollEntries.reduce((s, e) => s + e.net_salary, 0)

    const deliveryCosts = await prisma.deliveryCost.findMany({ include: { delivery: true } })
    const filteredDeliveryCost = deliveryCosts
      .filter((dc) => dc.createdAt >= from && dc.createdAt <= to)
      .reduce((s, dc) => s + dc.fuel_cost + dc.driver_fee + dc.hired_truck_cost, 0)

    const totalExpenses = manualExpenses + rawMaterialCost + payrollCost + filteredDeliveryCost

    return {
      income,
      expenses: { total: totalExpenses, manual: manualExpenses, rawMaterials: rawMaterialCost, payroll: payrollCost, delivery: filteredDeliveryCost },
      profit: income - totalExpenses,
      expenseBreakdown: expenses
    }
  })

  handle<DateRangePayload, ExportResult>('reports:exportInvoices', null, async (payload) => {
    const { from, to } = dateRange(payload)
    const invoices = await prisma.invoice.findMany({
      where: { date: { gte: from, lte: to } },
      include: { order: { include: { customer: true } }, payments: true },
      orderBy: { date: 'asc' }
    })

    const rows = [
      ['Invoice #', 'Date', 'Due Date', 'Customer', 'Total', 'Paid', 'Balance', 'Overdue'].join(','),
      ...invoices.map((inv: InvoiceWithOrderAndPayments) => {
        const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
        const customer = inv.order?.customer
        const name = (customer?.company_name || customer?.full_name || '').replace(/,/g, ' ')
        return [
          inv.number,
          inv.date.toISOString().slice(0, 10),
          inv.due_date ? inv.due_date.toISOString().slice(0, 10) : '',
          name,
          inv.total.toFixed(2),
          paid.toFixed(2),
          (inv.total - paid).toFixed(2),
          inv.is_overdue ? 'Yes' : 'No'
        ].join(',')
      })
    ]

    return {
      buffer: toCsvBase64(rows),
      filename: `invoices_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`
    }
  })

  handle<DateRangePayload, ExportResult>('reports:exportExpenses', null, async (payload) => {
    const { from, to } = dateRange(payload)
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' }
    })

    const rows = [
      ['Date', 'Category', 'Amount', 'Description'].join(','),
      ...expenses.map((e) => [e.date.toISOString().slice(0, 10), e.category, e.amount.toFixed(2), (e.description || '').replace(/,/g, ' ')].join(','))
    ]

    return {
      buffer: toCsvBase64(rows),
      filename: `expenses_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`
    }
  })

  handle<DateRangePayload, ExportResult>('reports:exportPayments', null, async (payload) => {
    const { from, to } = dateRange(payload)
    const payments = await prisma.payment.findMany({
      where: { date: { gte: from, lte: to } },
      include: { invoice: { include: { order: { include: { customer: true } } } } },
      orderBy: { date: 'asc' }
    })

    const rows = [
      ['Date', 'Invoice #', 'Customer', 'Amount', 'Method', 'Reference'].join(','),
      ...payments.map((p: PaymentWithInvoiceDetail) => {
        const customer = p.invoice?.order?.customer
        const name = (customer?.company_name || customer?.full_name || '').replace(/,/g, ' ')
        return [p.date.toISOString().slice(0, 10), p.invoice?.number || '', name, p.amount.toFixed(2), p.method, p.reference || ''].join(',')
      })
    ]

    return {
      buffer: toCsvBase64(rows),
      filename: `payments_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`
    }
  })
}
