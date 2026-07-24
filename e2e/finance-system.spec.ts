import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { launchApp } from './helpers'

const prisma = new PrismaClient()

let app: ElectronApplication
let window: Page
let adminToken: string

interface ExpenseDto {
  id: string
  category: string
}

interface ExpenseCategoryDto {
  id: string
  name: string
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

test('expenses:create then expenses:list shows it, with cleanup', async () => {
  const expenseBefore = await prisma.expense.count()

  const expense = await invokeWithToken<ExpenseDto>('expenses:create', adminToken, {
    category: 'Utilities',
    amount: 15000,
    date: '2026-07-01',
    description: 'Finance E2E test expense'
  })
  expect(expense.category).toBe('Utilities')

  try {
    const expenses = await invokeWithToken<ExpenseDto[]>('expenses:list', adminToken, {})
    expect(expenses.some((e) => e.id === expense.id)).toBe(true)
    expect(await prisma.expense.count()).toBe(expenseBefore + 1)
  } finally {
    await prisma.expense.delete({ where: { id: expense.id } }).catch(() => {})
  }

  expect(await prisma.expense.count()).toBe(expenseBefore)
})

test('expenseCategories:create then expenseCategories:list shows it, with cleanup', async () => {
  const categoryName = `Finance E2E Category ${Date.now()}`
  const categoryBefore = await prisma.expenseCategoryConfig.count()

  const category = await invokeWithToken<ExpenseCategoryDto>('expenseCategories:create', adminToken, { name: categoryName })
  expect(category.name).toBe(categoryName)

  try {
    const categories = await invokeWithToken<ExpenseCategoryDto[]>('expenseCategories:list', adminToken, {})
    expect(categories.some((c) => c.id === category.id)).toBe(true)
    expect(await prisma.expenseCategoryConfig.count()).toBe(categoryBefore + 1)
  } finally {
    await prisma.expenseCategoryConfig.delete({ where: { id: category.id } }).catch(() => {})
  }

  expect(await prisma.expenseCategoryConfig.count()).toBe(categoryBefore)
})

test('settings:updatePinnedKpis then settings:getPinnedKpis returns it, reset to [] after', async () => {
  try {
    const updated = await invokeWithToken<{ pinned_kpis: string[] }>('settings:updatePinnedKpis', adminToken, {
      pinned_kpis: ['bricksToday', 'totalStock']
    })
    expect(updated.pinned_kpis.sort()).toEqual(['bricksToday', 'totalStock'].sort())

    const fetched = await invokeWithToken<{ pinned_kpis: string[] }>('settings:getPinnedKpis', adminToken, {})
    expect(fetched.pinned_kpis.sort()).toEqual(['bricksToday', 'totalStock'].sort())
  } finally {
    // Reset to [] so this test never leaves pinned KPIs behind on the admin user.
    await invokeWithToken('settings:updatePinnedKpis', adminToken, { pinned_kpis: [] })
  }

  const reset = await invokeWithToken<{ pinned_kpis: string[] }>('settings:getPinnedKpis', adminToken, {})
  expect(reset.pinned_kpis).toEqual([])
})

test('dashboard:get resolves without throwing', async () => {
  const dashboard = await invokeWithToken<{ kpis: { bricksToday: number } }>('dashboard:get', adminToken, {})
  expect(dashboard.kpis).toBeDefined()
  expect(typeof dashboard.kpis.bricksToday).toBe('number')
})

test('reports:exportExpenses returns a non-empty base64 buffer', async () => {
  const result = await invokeWithToken<{ buffer: string; filename: string }>('reports:exportExpenses', adminToken, {})
  expect(result.buffer.length).toBeGreaterThan(0)
  expect(result.filename).toContain('expenses_')
  // buffer should be valid base64 decodable back to a CSV header row
  const decoded = Buffer.from(result.buffer, 'base64').toString('utf-8')
  expect(decoded).toContain('Date,Category,Amount,Description')
})

test('notifications:list resolves without throwing', async () => {
  const result = await invokeWithToken<{ notifications: unknown[]; unreadCount: number }>('notifications:list', adminToken, {})
  expect(Array.isArray(result.notifications)).toBe(true)
  expect(typeof result.unreadCount).toBe('number')
})

test('expenseCategories:delete is rejected for a non-ADMIN role', async () => {
  const category = await prisma.expenseCategoryConfig.create({
    data: { name: `Finance E2E Role Gate Category ${Date.now()}`, sort_order: 999 }
  })

  const hashed = await bcrypt.hash('NotAdmin@1234', 12)
  const nonAdmin = await prisma.user.create({
    data: {
      email: 'finance-non-admin-test@optimaclays.rw',
      password: hashed,
      full_name: 'Finance Non Admin Test User',
      role: 'ACCOUNTANT'
    }
  })

  try {
    const { token } = await invokePublic<{ token: string }>('auth:login', {
      email: 'finance-non-admin-test@optimaclays.rw',
      password: 'NotAdmin@1234'
    })
    // ACCOUNTANT can create/update expense categories but must not be able to delete them.
    await expect(invokeWithToken('expenseCategories:delete', token, { id: category.id })).rejects.toThrow('Forbidden')
  } finally {
    await prisma.user.delete({ where: { id: nonAdmin.id } })
    await prisma.expenseCategoryConfig.delete({ where: { id: category.id } }).catch(() => {})
  }
})
