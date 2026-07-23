import { test } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test('seeded admin user exists with the correct role and a valid password hash', async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@optimaclays.rw' } })
  assert.ok(admin, 'admin user should exist after seeding')
  assert.equal(admin.role, 'ADMIN')
  const passwordMatches = await bcrypt.compare('Admin@1234', admin.password)
  assert.ok(passwordMatches, 'seeded password hash should verify against Admin@1234')
})

test('pinned kpis child table stores and returns a list for a user', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'kpi-test@optimaclays.rw',
      password: 'not-a-real-hash',
      full_name: 'KPI Test User',
      role: 'ACCOUNTANT',
      pinnedKpis: { create: [{ kpi: 'revenue' }, { kpi: 'production' }] }
    },
    include: { pinnedKpis: true }
  })
  try {
    assert.equal(user.pinnedKpis.length, 2)
    assert.deepEqual(user.pinnedKpis.map((k) => k.kpi).sort(), ['production', 'revenue'])
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
  }
})

test('supplier material types child table stores and returns a list', async () => {
  const supplier = await prisma.supplier.create({
    data: {
      name: 'Test Supplier',
      materialTypes: { create: [{ materialType: 'CLAY' }, { materialType: 'SAND' }] }
    },
    include: { materialTypes: true }
  })
  try {
    assert.equal(supplier.materialTypes.length, 2)
  } finally {
    await prisma.supplier.delete({ where: { id: supplier.id } })
    const orphaned = await prisma.supplierMaterialType.findMany({ where: { supplierId: supplier.id } })
    assert.equal(orphaned.length, 0, 'material type rows should be cascade-deleted with their supplier')
  }
})

test('production batch defect types child table stores and returns a list', async () => {
  const kiln = await prisma.kiln.create({ data: { name: `Test Kiln ${Date.now()}` } })
  const batch = await prisma.productionBatch.create({
    data: {
      date: new Date(),
      shift: 'MORNING',
      kiln_number: '1',
      kilnId: kiln.id,
      bricks_target: 1000,
      defectTypes: { create: [{ defectType: 'CRACKING' }, { defectType: 'OVER_FIRING' }] }
    },
    include: { defectTypes: true }
  })
  try {
    assert.equal(batch.defectTypes.length, 2)
  } finally {
    await prisma.productionBatch.delete({ where: { id: batch.id } })
    const orphaned = await prisma.productionBatchDefectType.findMany({ where: { productionBatchId: batch.id } })
    assert.equal(orphaned.length, 0, 'defect type rows should be cascade-deleted with their production batch')
    await prisma.kiln.delete({ where: { id: kiln.id } })
  }
})

test('deleting a user cascades to its pinned kpis', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'cascade-test@optimaclays.rw',
      password: 'not-a-real-hash',
      full_name: 'Cascade Test User',
      role: 'SALES_OFFICER',
      pinnedKpis: { create: [{ kpi: 'orders' }] }
    }
  })
  await prisma.user.delete({ where: { id: user.id } })
  const orphaned = await prisma.userPinnedKpi.findMany({ where: { userId: user.id } })
  assert.equal(orphaned.length, 0, 'pinned kpi rows should be cascade-deleted with their user')
})

test.after(async () => {
  await prisma.$disconnect()
})
