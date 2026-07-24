import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

let app: ElectronApplication
let window: Page

test.beforeAll(async () => {
  app = await electron.launch({ args: [path.join(__dirname, '..', 'out', 'main', 'index.js')] })
  window = await app.firstWindow()
  await window.waitForSelector('input[type="email"]')
})

test.afterAll(async () => {
  await app.close()
})

test('login is rejected with a wrong password, shown as a toast', async () => {
  await window.fill('input[type="email"]', 'admin@optimaclays.rw')
  await window.fill('input[type="password"]', 'WrongPassword1')
  await window.click('button[type="submit"]')
  await window.waitForSelector('text=Invalid credentials', { timeout: 10000 })
})

test('logging in reaches the dashboard, sidebar renders, and pages navigate', async () => {
  await window.fill('input[type="email"]', 'admin@optimaclays.rw')
  await window.fill('input[type="password"]', 'Admin@1234')
  await window.click('button[type="submit"]')
  await window.waitForSelector('text=Dashboard', { timeout: 10000 })

  const bodyText = await window.textContent('body')
  expect(bodyText).toContain('Employees')
  expect(bodyText).toContain('Production')
  expect(bodyText).toContain('Customers')

  await window.click('text=Employees')
  await window.waitForSelector('text=Add Employee', { timeout: 10000 })
})
