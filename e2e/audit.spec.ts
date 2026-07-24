import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let app: ElectronApplication
let window: Page
let adminToken: string
let adminUserId: string

interface KilnDto {
  id: string
}

interface AuditLogDto {
  id: string
  user_id: string | null
  user_name: string | null
  action: string
  resource: string
  resource_id: string | null
  new_values: unknown
}

test.beforeAll(async () => {
  app = await electron.launch({ args: [path.join(__dirname, '..', 'out', 'main', 'index.js')] })
  window = await app.firstWindow()
  await window.waitForSelector('h1')

  const login = await invokePublic<{ token: string; user: { id: string } }>('auth:login', {
    email: 'admin@optimaclays.rw',
    password: 'Admin@1234'
  })
  adminToken = login.token
  adminUserId = login.user.id
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

test('kilns:create and kilns:delete each write an AuditLog row; kilns:list writes none', async () => {
  const kilnName = `Audit E2E Kiln ${Date.now()}`
  let kilnId: string | null = null
  const createdAuditIds: string[] = []

  try {
    // --- CREATE ---
    const kiln = await invokeWithToken<KilnDto>('kilns:create', adminToken, {
      name: kilnName,
      capacity: 500
    })
    kilnId = kiln.id
    expect(kilnId).toBeTruthy()

    const createLogs = await prisma.auditLog.findMany({
      where: { resource: 'kiln', action: 'CREATE', resource_id: kilnId }
    })
    expect(createLogs.length).toBe(1)
    createdAuditIds.push(createLogs[0].id)
    expect(createLogs[0].user_id).toBe(adminUserId)
    expect(createLogs[0].resource).toBe('kiln')
    expect(createLogs[0].action).toBe('CREATE')
    expect(createLogs[0].resource_id).toBe(kilnId)

    // --- READ-ONLY: should not write any audit row ---
    // Other e2e specs run concurrently and perform their own mutations (which now also
    // write audit rows), so a global table count would be flaky. Scoping to this test's
    // own kiln id keeps the assertion race-safe: nothing but our own CREATE above should
    // ever reference it.
    await invokeWithToken('kilns:list', adminToken, {})
    const logsForThisKilnAfterList = await prisma.auditLog.findMany({ where: { resource: 'kiln', resource_id: kilnId } })
    expect(logsForThisKilnAfterList.length).toBe(1)
    expect(logsForThisKilnAfterList[0].action).toBe('CREATE')

    // --- DELETE ---
    await invokeWithToken('kilns:delete', adminToken, { id: kilnId })

    const deleteLogs = await prisma.auditLog.findMany({
      where: { resource: 'kiln', action: 'DELETE', resource_id: kilnId }
    })
    expect(deleteLogs.length).toBe(1)
    createdAuditIds.push(deleteLogs[0].id)
    expect(deleteLogs[0].resource_id).toBe(kilnId)
    expect(deleteLogs[0].user_id).toBe(adminUserId)
    // Source middleware never populates new_values for DELETE actions.
    expect(deleteLogs[0].new_values).toBeNull()

    kilnId = null // deleted successfully, nothing left to clean up in the kiln table
  } finally {
    // Clean up any audit rows this test created.
    if (createdAuditIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } }).catch(() => {})
    }
    // In case kilns:delete failed partway through, still remove the kiln.
    if (kilnId) {
      await prisma.kiln.delete({ where: { id: kilnId } }).catch(() => {})
    }
  }
})
