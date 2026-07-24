import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync, existsSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'
import os from 'os'
import { PrismaClient } from '@prisma/client'
import { launchApp } from './helpers'

const prisma = new PrismaClient()

let app: ElectronApplication
let window: Page
let adminToken: string

interface CustomerDto {
  id: string
}

interface OrderDto {
  id: string
}

interface ProformaDto {
  id: string
  number: string
}

test.beforeAll(async () => {
  ;({ app, window } = await launchApp())
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

// Regression coverage for a real bug: dialogs:downloadPdf used to wrap the
// whole payslip/proforma/waybill HTML - including a multi-megabyte base64
// logo - into one data: URL, which silently failed to load past a URL
// length limit. This proves the fix produces an actual, valid, non-trivial
// PDF file on disk rather than an empty or missing one.
test('proformas:pdf produces a real PDF file via the download dialog', async () => {
  const targetPath = join(os.tmpdir(), `optima-clays-e2e-proforma-${Date.now()}.pdf`)
  let customerId: string | null = null
  let orderId: string | null = null
  let proformaId: string | null = null

  try {
    const customer = await invokeWithToken<CustomerDto>('customers:create', adminToken, {
      customer_type: 'INDIVIDUAL',
      full_name: `PDF Test Customer ${Date.now()}`,
      phone: '0788000000'
    })
    customerId = customer.id

    const order = await invokeWithToken<OrderDto>('orders:create', adminToken, {
      customerId,
      brick_type: 'CUSTOM',
      custom_name: 'E2E PDF Test Brick',
      quantity: 10,
      unit_price: 500
    })
    orderId = order.id

    const proforma = await invokeWithToken<ProformaDto>('proformas:create', adminToken, { orderId })
    proformaId = proforma.id

    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog
    }, targetPath)

    await invokeWithToken('proformas:pdf', adminToken, { id: proforma.id }).then(async (result) => {
      await invokeWithToken('dialogs:downloadPdf', adminToken, { ...(result as object), category: 'Proformas' })
    })

    expect(existsSync(targetPath)).toBe(true)
    const stats = statSync(targetPath)
    expect(stats.size).toBeGreaterThan(1000)
    const header = readFileSync(targetPath).subarray(0, 5).toString('latin1')
    expect(header).toBe('%PDF-')
  } finally {
    if (existsSync(targetPath)) unlinkSync(targetPath)
    // FK-safe order: proforma -> order -> customer.
    if (proformaId) await prisma.proformaInvoice.delete({ where: { id: proformaId } }).catch(() => {})
    if (orderId) await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
    if (customerId) await prisma.customer.delete({ where: { id: customerId } }).catch(() => {})
  }
})
