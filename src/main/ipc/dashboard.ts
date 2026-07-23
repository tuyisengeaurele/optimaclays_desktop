import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'

type OrderWithCustomer = Prisma.OrderGetPayload<{ include: { customer: true } }>
type InvoiceWithPayments = Prisma.InvoiceGetPayload<{ include: { payments: true } }>

interface DashboardResult {
  kpis: {
    bricksToday: number
    totalStock: number
    pendingOrders: number
    unpaidTotal: number
  }
  productionChart: Array<{ date: string; produced: number }>
  revenueChart: Array<{ month: string; revenue: number; expenses: number }>
  recentOrders: OrderWithCustomer[]
  lowStockAlerts: Array<{ material_type: string; current: number; threshold: number; unit: string; is_low: boolean }>
}

export function registerDashboardHandlers(): void {
  handle<void, DashboardResult>('dashboard:get', null, async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [todayBatches, finishedGoods, pendingOrders, invoices, recentOrders, productionLast30] = await Promise.all([
      prisma.productionBatch.findMany({ where: { date: { gte: today, lt: tomorrow } } }),
      prisma.finishedGoodsStock.findMany(),
      prisma.order.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.invoice.findMany({ where: { date: { gte: sixMonthsAgo } }, include: { payments: true } }),
      prisma.order.findMany({
        where: { deletedAt: null },
        include: { customer: true },
        orderBy: { order_date: 'desc' },
        take: 5
      }),
      prisma.productionBatch.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'asc' }
      })
    ])

    const bricksToday = todayBatches.reduce((s, b) => s + b.bricks_produced, 0)
    const totalStock = finishedGoods.reduce((s, g) => s + g.quantity, 0)

    const unpaidTotal = invoices.reduce((s: number, inv: InvoiceWithPayments) => {
      const paid = inv.payments.reduce((ps, p) => ps + p.amount, 0)
      const balance = inv.total - paid
      return s + (balance > 0 ? balance : 0)
    }, 0)

    // Production chart data
    const byDate: Record<string, number> = {}
    for (const b of productionLast30) {
      const d = b.date.toISOString().slice(0, 10)
      byDate[d] = (byDate[d] || 0) + b.bricks_produced
    }
    const productionChart = Object.entries(byDate).map(([date, produced]) => ({ date, produced }))

    // Revenue vs Expenses last 6 months
    const revenueByMonth: Record<string, number> = {}
    const payments = await prisma.payment.findMany({ where: { date: { gte: sixMonthsAgo } } })
    for (const p of payments) {
      const key = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}`
      revenueByMonth[key] = (revenueByMonth[key] || 0) + p.amount
    }

    const expensesByMonth: Record<string, number> = {}
    const expenses = await prisma.expense.findMany({ where: { date: { gte: sixMonthsAgo } } })
    for (const e of expenses) {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`
      expensesByMonth[key] = (expensesByMonth[key] || 0) + e.amount
    }

    const months = [...new Set([...Object.keys(revenueByMonth), ...Object.keys(expensesByMonth)])].sort()
    const revenueChart = months.map((m) => ({
      month: m,
      revenue: revenueByMonth[m] || 0,
      expenses: expensesByMonth[m] || 0
    }))

    // Low stock alerts
    const rawStocks = await prisma.rawMaterialStock.findMany()
    const consumptions = await prisma.rawMaterialConsumption.findMany()
    const thresholds = await prisma.stockThreshold.findMany()
    const lowStockAlerts = thresholds
      .map((t) => {
        const totalIn = rawStocks.filter((s) => s.material_type === t.material_type).reduce((s, r) => s + r.quantity, 0)
        const totalOut = consumptions.filter((c) => c.material_type === t.material_type).reduce((s, r) => s + r.quantity_used, 0)
        const current = totalIn - totalOut
        return { material_type: t.material_type, current, threshold: t.threshold, unit: t.unit, is_low: current <= t.threshold }
      })
      .filter((a) => a.is_low)

    return {
      kpis: { bricksToday, totalStock, pendingOrders, unpaidTotal },
      productionChart,
      revenueChart,
      recentOrders,
      lowStockAlerts
    }
  })
}
