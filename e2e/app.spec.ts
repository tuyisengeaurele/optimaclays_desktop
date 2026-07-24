import { test, expect } from '@playwright/test'
import { launchApp } from './helpers'

test('main window boots to the login page for an unauthenticated user', async () => {
  const { app, window } = await launchApp()
  try {
    await window.waitForSelector('h1')
    const heading = await window.textContent('h1')
    expect(heading).toBe('OPTIMA CLAYS LTD')
    await expect(window.locator('input[type="email"]')).toBeVisible()
    await expect(window.locator('input[type="password"]')).toBeVisible()
  } finally {
    await app.close()
  }
})
