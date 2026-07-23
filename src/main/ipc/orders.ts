import type { BrickType, Customer, OrderStatus, Prisma, QualityGrade } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'
import { getAvailableStock } from './inventory'

type OrderWithCustomerAndInvoiceIds = Prisma.OrderGetPayload<{
  include: { customer: true; invoices: { select: { id: true } } }
}>
type OrderWithCustomer = Prisma.OrderGetPayload<{ include: { customer: true } }>
type OrderWithFullDetail = Prisma.OrderGetPayload<{
  include: { customer: true; invoices: { include: { payments: true } }; deliveries: true }
}>
type OrderForStatement = Prisma.OrderGetPayload<{
  include: { invoices: { include: { payments: true; items: true } }; deliveries: true }
}>

interface CreateOrderPayload {
  customerId: string
  brick_type: BrickType
  quantity: number | string
  unit_price: number | string
  quality_grade?: QualityGrade
  notes?: string | null
  order_date?: string
  custom_name?: string | null
}

interface GetOrderPayload {
  id: string
}

interface UpdateOrderPayload {
  id: string
  quantity?: number | string
  unit_price?: number | string
  notes?: string | null
  required_delivery_date?: string
}

interface UpdateOrderStatusPayload {
  id: string
  status: OrderStatus
  notes?: string
}

interface DeleteOrderPayload {
  id: string
}

interface CustomerStatementPayload {
  customerId: string
}

interface CustomerStatementResult {
  customer: Customer
  orders: OrderForStatement[]
  summary: {
    totalOrdered: number
    totalInvoiced: number
    totalPaid: number
    outstanding: number
    creditLimit: number
  }
}

async function getCustomerOutstanding(customerId: string): Promise<number> {
  const invoices = await prisma.invoice.findMany({
    where: { order: { customerId, deletedAt: null } },
    include: { payments: true }
  })
  let outstanding = 0
  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
    outstanding += Math.max(0, inv.total - paid)
  }
  return outstanding
}

export function registerOrderHandlers(): void {
  handle<void, OrderWithCustomerAndInvoiceIds[]>('orders:list', null, async () =>
    prisma.order.findMany({
      where: { deletedAt: null },
      include: { customer: true, invoices: { select: { id: true } } },
      orderBy: { order_date: 'desc' }
    })
  )

  handle<CreateOrderPayload, OrderWithCustomer>(
    'orders:create',
    null,
    async ({ customerId, brick_type, quantity, unit_price, quality_grade, notes, order_date, custom_name }) => {
      if (!customerId) throw new BadRequestError('customerId is required')
      if (!brick_type) throw new BadRequestError('brick_type is required')
      if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) throw new BadRequestError('quantity must be a positive number')
      if (!unit_price || isNaN(Number(unit_price)) || Number(unit_price) <= 0) throw new BadRequestError('unit_price must be a positive number')

      const customer = await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } })
      if (!customer) throw new NotFoundError('Customer not found')

      const qty = Number(quantity)
      const price = Number(unit_price)
      const total = qty * price
      const grade = quality_grade || 'GRADE_A'

      if (brick_type !== 'CUSTOM') {
        const available = await getAvailableStock(brick_type, grade)
        if (available < qty) {
          throw new BadRequestError(`Not enough stock. Available: ${available.toLocaleString()}, requested: ${qty.toLocaleString()}`)
        }
      }

      if (customer.credit_limit > 0) {
        const outstanding = await getCustomerOutstanding(customerId)
        if (outstanding + total > customer.credit_limit) {
          throw new BadRequestError(`Order total exceeds customer credit limit. Outstanding: ${outstanding.toFixed(2)}, Limit: ${customer.credit_limit}`)
        }
      }

      return prisma.order.create({
        data: {
          customerId,
          brick_type,
          custom_name: custom_name || null,
          quantity: qty,
          unit_price: price,
          total_amount: total,
          quality_grade: grade,
          notes: notes || null,
          order_date: order_date ? new Date(order_date) : new Date()
        },
        include: { customer: true }
      })
    }
  )

  handle<GetOrderPayload, OrderWithFullDetail>('orders:get', null, async ({ id }) => {
    const order = await prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: { customer: true, invoices: { include: { payments: true } }, deliveries: true }
    })
    if (!order) throw new NotFoundError('Order not found')
    return order
  })

  handle<UpdateOrderPayload, OrderWithCustomer>(
    'orders:update',
    null,
    async ({ id, quantity, unit_price, notes, required_delivery_date }) => {
      const order = await prisma.order.findFirst({ where: { id, deletedAt: null } })
      if (!order) throw new NotFoundError('Order not found')
      if (order.status !== 'PENDING') throw new BadRequestError('Only PENDING orders can be amended')

      const qty = quantity != null ? Number(quantity) : order.quantity
      const price = unit_price != null ? Number(unit_price) : order.unit_price
      if (qty <= 0) throw new BadRequestError('quantity must be positive')
      if (price <= 0) throw new BadRequestError('unit_price must be positive')

      if (qty > order.quantity && order.brick_type !== 'CUSTOM') {
        const available = await getAvailableStock(order.brick_type, order.quality_grade)
        if (available < qty) {
          throw new BadRequestError(`Not enough stock. Available: ${available.toLocaleString()}, requested: ${qty.toLocaleString()}`)
        }
      }

      return prisma.order.update({
        where: { id },
        data: {
          quantity: qty,
          unit_price: price,
          total_amount: qty * price,
          notes: notes !== undefined ? notes || null : undefined,
          required_delivery_date: required_delivery_date ? new Date(required_delivery_date) : undefined
        },
        include: { customer: true }
      })
    }
  )

  handle<DeleteOrderPayload, { deleted: boolean }>('orders:delete', ['ADMIN'], async ({ id }) => {
    const order = await prisma.order.findFirst({ where: { id, deletedAt: null } })
    if (!order) throw new NotFoundError('Order not found')
    await prisma.order.update({ where: { id }, data: { deletedAt: new Date() } })
    return { deleted: true }
  })

  handle<UpdateOrderStatusPayload, OrderWithCustomer>('orders:updateStatus', null, async ({ id, status, notes }) => {
    const order = await prisma.order.findFirst({ where: { id, deletedAt: null } })
    if (!order) throw new NotFoundError('Order not found')
    if (!status) throw new BadRequestError('status is required')
    // DELIVERED is only ever set from the delivery completion flow, which has its own
    // record of what was actually delivered, not from a manual status change here.
    if (status === 'DELIVERED') throw new BadRequestError('Delivered status is set automatically when a delivery is completed')
    return prisma.order.update({
      where: { id },
      data: { status, ...(notes !== undefined ? { notes } : {}) },
      include: { customer: true }
    })
  })

  handle<CustomerStatementPayload, CustomerStatementResult>('orders:customerStatement', null, async ({ customerId }) => {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } })
    if (!customer) throw new NotFoundError('Customer not found')

    const orders = await prisma.order.findMany({
      where: { customerId, deletedAt: null },
      include: {
        invoices: { include: { payments: true, items: true } },
        deliveries: true
      },
      orderBy: { order_date: 'desc' }
    })

    let totalOrdered = 0
    let totalInvoiced = 0
    let totalPaid = 0

    for (const o of orders) {
      totalOrdered += o.total_amount
      for (const inv of o.invoices) {
        totalInvoiced += inv.total
        for (const p of inv.payments) {
          totalPaid += p.amount
        }
      }
    }

    return {
      customer,
      orders,
      summary: {
        totalOrdered,
        totalInvoiced,
        totalPaid,
        outstanding: totalInvoiced - totalPaid,
        creditLimit: customer.credit_limit
      }
    }
  })
}
