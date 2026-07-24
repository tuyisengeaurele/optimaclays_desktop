import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'

const PAGES_TO_CHECK: Array<{ href: string; expectText: string }> = [
  { href: '#/', expectText: 'Revenue' },
  { href: '#/employees', expectText: 'Employees' },
  { href: '#/attendance', expectText: 'Attendance' },
  { href: '#/payroll', expectText: 'Payroll' },
  { href: '#/production', expectText: 'Production' },
  { href: '#/kilns', expectText: 'Kilns' },
  { href: '#/inventory', expectText: 'Inventory' },
  { href: '#/suppliers', expectText: 'Suppliers' },
  { href: '#/reconciliation', expectText: 'Reconciliation' },
  { href: '#/customers', expectText: 'Customers' },
  { href: '#/orders', expectText: 'Orders' },
  { href: '#/price-catalogue', expectText: 'Price' },
  { href: '#/invoices', expectText: 'Invoices' },
  { href: '#/proformas', expectText: 'Proforma' },
  { href: '#/deliveries', expectText: 'Deliveries' },
  { href: '#/financials', expectText: 'Financial' },
  { href: '#/reports', expectText: 'Reports' },
  { href: '#/import', expectText: 'Import' },
  { href: '#/audit', expectText: 'Audit' },
  { href: '#/users', expectText: 'Users' },
  { href: '#/settings', expectText: 'Settings' }
]

test.setTimeout(120000)

test('every sidebar page renders without console errors', async () => {
  const app = await electron.launch({ args: [path.join(__dirname, '..', 'out', 'main', 'index.js')] })
  const window = await app.firstWindow()
  const consoleErrors: string[] = []
  window.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  window.on('pageerror', (err) => consoleErrors.push(err.message))

  try {
    await window.waitForSelector('input[type="email"]')
    await window.fill('input[type="email"]', 'admin@optimaclays.rw')
    await window.fill('input[type="password"]', 'Admin@1234')
    await window.click('button[type="submit"]')
    await window.waitForSelector('text=Dashboard', { timeout: 10000 })

    for (const page of PAGES_TO_CHECK) {
      console.log(`navigating to: ${page.href}`)
      await window.click(`nav a[href="${page.href}"]`, { timeout: 5000 })
      await window.waitForTimeout(300)
      const bodyText = await window.textContent('body')
      expect(bodyText, `page "${page.href}" should contain "${page.expectText}"`).toContain(page.expectText)
      console.log(`ok: ${page.href}`)
    }

    expect(consoleErrors, `console errors seen while navigating: ${consoleErrors.join('\n')}`).toEqual([])
  } finally {
    await app.close()
  }
})
