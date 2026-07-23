import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let app: ElectronApplication
let window: Page
let adminToken: string

interface CustomerDto {
  id: string
  full_name: string | null
}

interface OrderDto {
  id: string
  status: string
}

interface PriceCatalogueDto {
  id: string
  brick_type: string
}

interface InvoiceDto {
  id: string
  number: string
}

interface ProformaDto {
  id: string
  number: string
}

interface PaymentDto {
  id: string
  invoiceId: string
}

interface DeliveryDto {
  id: string
}

test.beforeAll(async () => {
  app = await electron.launch({ args: [path.join(__dirname, '..', 'out', 'main', 'index.js')] })
  window = await app.firstWindow()
  await window.waitForSelector('h1')

  const login = await invokePublic<{ token: string }>('auth:login', {
    email: 'admin@optimaclays.rw',
    password: 'Admin@1234'
  })
  adminToken = login.token
})

test.afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

function invokePublic<T>(channel: string, payload: unknown): Promise<T> {
  return window.evaluate(
    ({ channel, payload }) => (window as unknown as { api: { invokePublic: (c: string, p: unknown) => Promise<unknown> } }).api.invokePublic(channel, payload) as Promise<T>,
    { channel, payload }
  )
}

function invokeWithToken<T>(channel: string, token: string | null, payload: unknown): Promise<T> {
  return window.evaluate(
    ({ channel, token, payload }) => {
      const api = (window as unknown as { api: { invoke: (c: string, p: unknown) => Promise<unknown>; setToken: (t: string | null) => void } }).api
      api.setToken(token)
      return api.invoke(channel, payload) as Promise<unknown>
    },
    { channel, token, payload }
  ) as Promise<T>
}

test('customers -> orders -> priceCatalogue -> invoices -> proformas -> payments -> deliveries round-trip through real IPC, with cleanup', async () => {
  const customerBefore = await prisma.customer.count()
  const orderBefore = await prisma.order.count()
  const priceBefore = await prisma.priceCatalogue.count()
  const invoiceBefore = await prisma.invoice.count()
  const proformaBefore = await prisma.proformaInvoice.count()
  const paymentBefore = await prisma.payment.count()
  const deliveryBefore = await prisma.delivery.count()

  const customerName = `Sales E2E Customer ${Date.now()}`
  let customerId: string | null = null
  let orderId: string | null = null
  let priceId: string | null = null
  let invoiceId: string | null = null
  let proformaId: string | null = null
  let paymentId: string | null = null
  let deliveryId: string | null = null

  try {
    // customers:create
    const customer = await invokeWithToken<CustomerDto>('customers:create', adminToken, {
      customer_type: 'INDIVIDUAL',
      full_name: customerName,
      phone: '0788000000'
    })
    customerId = customer.id
    expect(customer.full_name).toBe(customerName)

    // customers:list shows it
    const customers = await invokeWithToken<CustomerDto[]>('customers:list', adminToken, {})
    expect(customers.some((c) => c.id === customerId)).toBe(true)
    expect(await prisma.customer.count()).toBe(customerBefore + 1)

    // orders:create for that customer (CUSTOM brick type skips the finished-goods stock
    // check, so the test doesn't depend on any inventory being seeded)
    const order = await invokeWithToken<OrderDto>('orders:create', adminToken, {
      customerId,
      brick_type: 'CUSTOM',
      custom_name: 'E2E Test Brick',
      quantity: 100,
      unit_price: 500
    })
    orderId = order.id
    expect(order.status).toBe('PENDING')

    // orders:list shows it
    const orders = await invokeWithToken<OrderDto[]>('orders:list', adminToken, {})
    expect(orders.some((o) => o.id === orderId)).toBe(true)
    expect(await prisma.order.count()).toBe(orderBefore + 1)

    // priceCatalogue:upsert then priceCatalogue:list shows it
    const price = await invokeWithToken<PriceCatalogueDto>('priceCatalogue:upsert', adminToken, {
      brick_type: 'LOW_ROCK_BOND',
      unit_price: 750
    })
    priceId = price.id
    expect(price.brick_type).toBe('LOW_ROCK_BOND')

    const prices = await invokeWithToken<PriceCatalogueDto[]>('priceCatalogue:list', adminToken, {})
    expect(prices.some((p) => p.id === priceId)).toBe(true)

    // invoices:create for that order, then invoices:list shows it
    const invoice = await invokeWithToken<InvoiceDto>('invoices:create', adminToken, { orderId })
    invoiceId = invoice.id
    expect(invoice.number).toBeTruthy()

    const invoices = await invokeWithToken<InvoiceDto[]>('invoices:list', adminToken, {})
    expect(invoices.some((i) => i.id === invoiceId)).toBe(true)
    expect(await prisma.invoice.count()).toBe(invoiceBefore + 1)

    // proformas:create, then proformas:pdf returns real HTML containing the customer's name
    const proforma = await invokeWithToken<ProformaDto>('proformas:create', adminToken, { orderId })
    proformaId = proforma.id
    expect(proforma.number).toMatch(/^PRO-/)
    expect(await prisma.proformaInvoice.count()).toBe(proformaBefore + 1)

    const pdf = await invokeWithToken<{ html: string; filename: string }>('proformas:pdf', adminToken, { id: proformaId })
    expect(pdf.html).toContain(customerName)
    expect(pdf.html).toContain(proforma.number)
    expect(pdf.filename).toContain('Proforma-')

    // payments:create against the invoice, then payments:list shows it
    const payment = await invokeWithToken<PaymentDto>('payments:create', adminToken, {
      invoiceId,
      amount: 20000,
      method: 'CASH'
    })
    paymentId = payment.id
    expect(payment.invoiceId).toBe(invoiceId)

    const payments = await invokeWithToken<PaymentDto[]>('payments:list', adminToken, { invoiceId })
    expect(payments.some((p) => p.id === paymentId)).toBe(true)
    expect(await prisma.payment.count()).toBe(paymentBefore + 1)

    // deliveries:create for the order requires the order to be marked Ready first
    await invokeWithToken('orders:updateStatus', adminToken, { id: orderId, status: 'READY' })

    const delivery = await invokeWithToken<DeliveryDto>('deliveries:create', adminToken, {
      orderId,
      vehicle_plate: 'RAD 123 A',
      driver_name: 'E2E Test Driver',
      quantity_loaded: 100
    })
    deliveryId = delivery.id
    expect(await prisma.delivery.count()).toBe(deliveryBefore + 1)

    // deliveries:waybill returns real HTML
    const waybill = await invokeWithToken<{ html: string; filename: string }>('deliveries:waybill', adminToken, { id: deliveryId })
    expect(waybill.html).toContain(customerName)
    expect(waybill.filename).toContain('Waybill-')
  } finally {
    // Clean up in FK-safe order: deliveries -> payments -> invoices -> proformas -> orders -> customers -> price catalogue entries.
    if (deliveryId) {
      await prisma.deliveryCost.deleteMany({ where: { deliveryId } })
      await prisma.delivery.delete({ where: { id: deliveryId } }).catch(() => {})
    }
    if (paymentId) {
      await prisma.payment.delete({ where: { id: paymentId } }).catch(() => {})
    }
    if (invoiceId) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId } })
      await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {})
    }
    if (proformaId) {
      await prisma.proformaInvoice.delete({ where: { id: proformaId } }).catch(() => {})
    }
    if (orderId) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
    }
    if (customerId) {
      await prisma.customer.delete({ where: { id: customerId } }).catch(() => {})
    }
    if (priceId) {
      await prisma.priceCatalogue.delete({ where: { id: priceId } }).catch(() => {})
    }
  }

  expect(await prisma.customer.count()).toBe(customerBefore)
  expect(await prisma.order.count()).toBe(orderBefore)
  expect(await prisma.priceCatalogue.count()).toBe(priceBefore)
  expect(await prisma.invoice.count()).toBe(invoiceBefore)
  expect(await prisma.proformaInvoice.count()).toBe(proformaBefore)
  expect(await prisma.payment.count()).toBe(paymentBefore)
  expect(await prisma.delivery.count()).toBe(deliveryBefore)
})

test('orders:delete is rejected for a non-ADMIN role', async () => {
  const customer = await prisma.customer.create({
    data: { customer_type: 'INDIVIDUAL', full_name: `Role Gate Customer ${Date.now()}` }
  })
  const order = await invokeWithToken<OrderDto>('orders:create', adminToken, {
    customerId: customer.id,
    brick_type: 'CUSTOM',
    custom_name: 'Role Gate Brick',
    quantity: 10,
    unit_price: 100
  })

  const hashed = await bcrypt.hash('NotAdmin@1234', 12)
  const nonAdmin = await prisma.user.create({
    data: {
      email: 'sales-non-admin-test@optimaclays.rw',
      password: hashed,
      full_name: 'Sales Non Admin Test User',
      role: 'SALES_OFFICER'
    }
  })

  try {
    const { token } = await invokePublic<{ token: string }>('auth:login', {
      email: 'sales-non-admin-test@optimaclays.rw',
      password: 'NotAdmin@1234'
    })
    // SALES_OFFICER can create/update orders but must not be able to delete them.
    await expect(invokeWithToken('orders:delete', token, { id: order.id })).rejects.toThrow('Forbidden')
  } finally {
    await prisma.user.delete({ where: { id: nonAdmin.id } })
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
    await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {})
  }
})
