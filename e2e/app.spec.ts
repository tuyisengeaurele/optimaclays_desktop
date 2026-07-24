import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'

test('main window boots to the login page for an unauthenticated user', async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'out', 'main', 'index.js')]
  })
  try {
    const window = await app.firstWindow()
    await window.waitForSelector('h1')
    const heading = await window.textContent('h1')
    expect(heading).toBe('OPTIMA CLAYS LTD')
    await expect(window.locator('input[type="email"]')).toBeVisible()
    await expect(window.locator('input[type="password"]')).toBeVisible()
  } finally {
    await app.close()
  }
})
