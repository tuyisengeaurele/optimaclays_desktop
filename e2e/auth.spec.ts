import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { launchApp } from './helpers'

const prisma = new PrismaClient()

let app: ElectronApplication
let window: Page

test.beforeAll(async () => {
  ;({ app, window } = await launchApp())
  await window.waitForSelector('h1')
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

test('login succeeds with the correct admin credentials', async () => {
  const result = await invokePublic<{ token: string; user: { role: string } }>('auth:login', {
    email: 'admin@optimaclays.rw',
    password: 'Admin@1234'
  })
  expect(result.token).toBeTruthy()
  expect(result.user.role).toBe('ADMIN')
})

test('login is rejected with a wrong password', async () => {
  await expect(
    invokePublic('auth:login', { email: 'admin@optimaclays.rw', password: 'WrongPassword1' })
  ).rejects.toThrow('Invalid credentials')
})

test('auth:profile is rejected with no token', async () => {
  await expect(invokeWithToken('auth:profile', null, {})).rejects.toThrow()
})

test('auth:profile is rejected with a forged token', async () => {
  await expect(invokeWithToken('auth:profile', 'not-a-real-session-token', {})).rejects.toThrow()
})

test('auth:profile succeeds with a real token from login', async () => {
  const { token } = await invokePublic<{ token: string }>('auth:login', {
    email: 'admin@optimaclays.rw',
    password: 'Admin@1234'
  })
  const profile = await invokeWithToken<{ email: string; pinnedKpis: string[] }>('auth:profile', token, {})
  expect(profile.email).toBe('admin@optimaclays.rw')
  expect(Array.isArray(profile.pinnedKpis)).toBe(true)
})

test('auth:listUsers is rejected for a non-admin role', async () => {
  const hashed = await bcrypt.hash('NotAdmin@1234', 12)
  const nonAdmin = await prisma.user.create({
    data: {
      email: 'non-admin-test@optimaclays.rw',
      password: hashed,
      full_name: 'Non Admin Test User',
      role: 'SALES_OFFICER'
    }
  })
  try {
    const { token } = await invokePublic<{ token: string }>('auth:login', {
      email: 'non-admin-test@optimaclays.rw',
      password: 'NotAdmin@1234'
    })
    await expect(invokeWithToken('auth:listUsers', token, {})).rejects.toThrow('Forbidden')
  } finally {
    await prisma.user.delete({ where: { id: nonAdmin.id } })
  }
})

test('logout tolerates a missing or invalid token without throwing', async () => {
  const noToken = await invokePublic('auth:logout', { token: null })
  expect(noToken).toBe(null)
  const forgedToken = await invokePublic('auth:logout', { token: 'not-a-real-session-token' })
  expect(forgedToken).toBe(null)
})
