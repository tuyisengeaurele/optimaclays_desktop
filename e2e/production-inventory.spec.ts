import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let app: ElectronApplication
let window: Page
let adminToken: string

interface KilnDto {
  id: string
  name: string
}

interface ProductionBatchDto {
  id: string
  defectTypes: string[]
}

interface SupplierDto {
  id: string
  name: string
  materialTypes: string[]
}

interface RawMaterialStockDto {
  id: string
  material_type: string
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

test('kilns:create then kilns:list shows it, with cleanup', async () => {
  const before = await prisma.kiln.count()
  const kiln = await invokeWithToken<KilnDto>('kilns:create', adminToken, {
    name: `Test Kiln ${Date.now()}`,
    capacity: 5000
  })

  try {
    const kilns = await invokeWithToken<KilnDto[]>('kilns:list', adminToken, {})
    expect(kilns.some((k) => k.id === kiln.id)).toBe(true)
    expect(await prisma.kiln.count()).toBe(before + 1)
  } finally {
    await prisma.kiln.delete({ where: { id: kiln.id } }).catch(() => {})
  }
  expect(await prisma.kiln.count()).toBe(before)
})

test('production:create round-trips defectTypes through the child table, then production:list shows it, with cleanup', async () => {
  const before = await prisma.productionBatch.count()
  const batch = await invokeWithToken<ProductionBatchDto>('production:create', adminToken, {
    date: '2026-07-01',
    shift: 'MORNING',
    bricks_target: 1000,
    defectTypes: ['CRACKING']
  })

  try {
    expect(batch.defectTypes).toEqual(['CRACKING'])

    const listResult = await invokeWithToken<{ batches: ProductionBatchDto[] }>('production:list', adminToken, {})
    expect(listResult.batches.some((b) => b.id === batch.id)).toBe(true)
    expect(await prisma.productionBatch.count()).toBe(before + 1)
  } finally {
    await prisma.productionBatchDefectType.deleteMany({ where: { productionBatchId: batch.id } })
    await prisma.productionBatch.delete({ where: { id: batch.id } }).catch(() => {})
  }
  expect(await prisma.productionBatch.count()).toBe(before)
})

test('suppliers:create round-trips materialTypes through the child table, with cleanup', async () => {
  const before = await prisma.supplier.count()
  const supplier = await invokeWithToken<SupplierDto>('suppliers:create', adminToken, {
    name: `Test Supplier ${Date.now()}`,
    materialTypes: ['CLAY', 'SAND']
  })

  try {
    expect(supplier.materialTypes.sort()).toEqual(['CLAY', 'SAND'])
    expect(await prisma.supplier.count()).toBe(before + 1)
  } finally {
    await prisma.supplierMaterialType.deleteMany({ where: { supplierId: supplier.id } })
    await prisma.supplier.delete({ where: { id: supplier.id } }).catch(() => {})
  }
  expect(await prisma.supplier.count()).toBe(before)
})

test('inventory:addRawMaterial then inventory:listRawMaterials shows it, with cleanup', async () => {
  const before = await prisma.rawMaterialStock.count()
  const stock = await invokeWithToken<RawMaterialStockDto>('inventory:addRawMaterial', adminToken, {
    material_type: 'CLAY',
    quantity: 100,
    unit: 'kg',
    unit_cost: 50,
    total_cost: 5000,
    date: '2026-07-01'
  })

  try {
    const result = await invokeWithToken<{ stocks: RawMaterialStockDto[] }>('inventory:listRawMaterials', adminToken, {})
    expect(result.stocks.some((s) => s.id === stock.id)).toBe(true)
    expect(await prisma.rawMaterialStock.count()).toBe(before + 1)
  } finally {
    await prisma.rawMaterialStock.delete({ where: { id: stock.id } }).catch(() => {})
  }
  expect(await prisma.rawMaterialStock.count()).toBe(before)
})

test('kilns:delete is rejected for a non-ADMIN role', async () => {
  const kiln = await invokeWithToken<KilnDto>('kilns:create', adminToken, {
    name: `Role Gate Kiln ${Date.now()}`,
    capacity: 1000
  })

  const hashed = await bcrypt.hash('NotAdmin@1234', 12)
  const nonAdmin = await prisma.user.create({
    data: {
      email: 'production-non-admin-test@optimaclays.rw',
      password: hashed,
      full_name: 'Production Non Admin Test User',
      role: 'PRODUCTION_SUPERVISOR'
    }
  })

  try {
    const { token } = await invokePublic<{ token: string }>('auth:login', {
      email: 'production-non-admin-test@optimaclays.rw',
      password: 'NotAdmin@1234'
    })
    // PRODUCTION_SUPERVISOR can create/update kilns but must not be able to delete them.
    await expect(invokeWithToken('kilns:delete', token, { id: kiln.id })).rejects.toThrow('Forbidden')
  } finally {
    await prisma.user.delete({ where: { id: nonAdmin.id } })
    await prisma.kiln.delete({ where: { id: kiln.id } }).catch(() => {})
  }
})
