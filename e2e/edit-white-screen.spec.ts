import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { launchApp } from './helpers'

const prisma = new PrismaClient()

let app: ElectronApplication
let window: Page
let adminToken: string

test.beforeAll(async () => {
  ;({ app, window } = await launchApp())
  await window.waitForSelector('input[type="email"]')
  await window.fill('input[type="email"]', 'admin@optimaclays.rw')
  await window.fill('input[type="password"]', 'Admin@1234')
  await window.click('button[type="submit"]')
  await window.waitForSelector('text=Dashboard')

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

async function assertPageDidNotBlank(label: string): Promise<void> {
  await window.waitForTimeout(300)
  const bodyText = await window.textContent('body')
  expect(bodyText?.length ?? 0, `${label}: page went blank after opening edit`).toBeGreaterThan(50)
}

// Regression coverage for a real bug: DateTime fields arrive over IPC as
// native Date objects (structured clone), not the ISO strings a JSON/HTTP
// API would send, so code written against the source web app that called
// .slice(0, 10) directly on a date field crashed with no error boundary to
// catch it, blanking the whole app. This clicks Edit for real through the
// UI on every page that had the bug - IPC-only round-trip tests never
// caught it because they never rendered the edit form.
test('editing an employee with a hire_date does not blank the page', async () => {
  const employee = await invokeWithToken<{ id: string }>('employees:create', adminToken, {
    full_name: `Edit Test Employee ${Date.now()}`,
    national_id: `EDIT-TEST-${Date.now()}`,
    hire_date: '2024-01-01',
    wage_type: 'MONTHLY',
    base_salary: 100000
  })

  try {
    await window.click('a[href="#/employees"]')
    await window.waitForSelector(`text=Edit Test Employee`, { timeout: 10000 })
    await window.locator('tr', { hasText: 'Edit Test Employee' }).locator('button').first().click()
    await assertPageDidNotBlank('employees')
    await expect(window.locator('text=Edit Employee')).toBeVisible()
    await window.click('button:has-text("Cancel")')
  } finally {
    await prisma.employee.delete({ where: { id: employee.id } }).catch(() => {})
  }
})

test('editing a kiln with a last_service_date does not blank the page', async () => {
  const kilnName = `Edit Test Kiln ${Date.now()}`
  const kiln = await invokeWithToken<{ id: string }>('kilns:create', adminToken, {
    name: kilnName,
    capacity: 5000,
    last_service_date: '2024-06-15'
  })

  try {
    await window.click('a[href="#/kilns"]')
    await window.waitForSelector(`text=${kilnName}`, { timeout: 10000 })
    await window.locator('tr', { hasText: kilnName }).locator('button:has-text("Edit")').click()
    await assertPageDidNotBlank('kilns')
    await expect(window.locator('text=Edit Kiln')).toBeVisible()
    await window.click('button:has-text("Cancel")')
  } finally {
    await prisma.kiln.delete({ where: { id: kiln.id } }).catch(() => {})
  }
})

test('editing an order does not blank the page (order_date is always set)', async () => {
  const customerName = `Edit Test Order Customer ${Date.now()}`
  const customer = await invokeWithToken<{ id: string }>('customers:create', adminToken, {
    customer_type: 'INDIVIDUAL',
    full_name: customerName,
    phone: '0788000000'
  })
  const order = await invokeWithToken<{ id: string }>('orders:create', adminToken, {
    customerId: customer.id,
    brick_type: 'CUSTOM',
    custom_name: `Edit Test Order Brick ${Date.now()}`,
    quantity: 10,
    unit_price: 500,
    required_delivery_date: '2026-08-01'
  })

  try {
    await window.click('a[href="#/orders"]')
    await window.waitForSelector(`text=${customerName}`, { timeout: 10000 })
    await window.locator('tr', { hasText: customerName }).locator('button[title="Amend Order"]').click()
    await assertPageDidNotBlank('orders')
    await expect(window.locator('text=Amend Order')).toBeVisible()
    await window.click('button:has-text("Cancel")')
  } finally {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
    await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {})
  }
})

test('editing a production batch does not blank the page', async () => {
  const kilnNumber = `EDIT-TEST-${Date.now()}`
  const batch = await invokeWithToken<{ id: string }>('production:create', adminToken, {
    date: '2026-07-01',
    shift: 'MORNING',
    kiln_number: kilnNumber,
    bricks_target: 1000
  })

  try {
    await window.click('a[href="#/production"]')
    await window.waitForSelector(`text=${kilnNumber}`, { timeout: 10000 })
    await window.locator('tr', { hasText: kilnNumber }).locator('button[title="Edit"]').click()
    await assertPageDidNotBlank('production')
  } finally {
    await prisma.productionBatchDefectType.deleteMany({ where: { productionBatchId: batch.id } })
    await prisma.productionBatch.delete({ where: { id: batch.id } }).catch(() => {})
  }
})
