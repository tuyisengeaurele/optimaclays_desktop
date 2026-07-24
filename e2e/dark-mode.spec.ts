import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp } from './helpers'

let app: ElectronApplication
let window: Page

test.beforeAll(async () => {
  ;({ app, window } = await launchApp())
  await window.waitForSelector('input[type="email"]')
  await window.fill('input[type="email"]', 'admin@optimaclays.rw')
  await window.fill('input[type="password"]', 'Admin@1234')
  await window.click('button[type="submit"]')
  await window.waitForSelector('text=Dashboard')
})

test.afterAll(async () => {
  await app.close()
})

test('toggling dark mode applies the class and persists across reload', async () => {
  const htmlHasDarkClass = () => window.evaluate(() => document.documentElement.classList.contains('dark'))

  const startedDark = await htmlHasDarkClass()
  await window.click(`button[title="${startedDark ? 'Switch to light mode' : 'Switch to dark mode'}"]`)
  expect(await htmlHasDarkClass()).toBe(!startedDark)

  const stored = await window.evaluate(() => window.localStorage.getItem('optima-clays-theme'))
  expect(stored).toBe(startedDark ? 'light' : 'dark')

  // A full reload re-runs the preload script, which resets the in-memory
  // session token - reload lands back on the login page, but the theme
  // class is read from localStorage before any auth check happens, so it
  // should still be correct.
  await window.reload()
  await window.waitForSelector('input[type="email"]')
  expect(await htmlHasDarkClass()).toBe(!startedDark)

  // log back in and leave the theme the way it started
  await window.fill('input[type="email"]', 'admin@optimaclays.rw')
  await window.fill('input[type="password"]', 'Admin@1234')
  await window.click('button[type="submit"]')
  await window.waitForSelector('text=Dashboard')
  await window.click(`button[title="${!startedDark ? 'Switch to light mode' : 'Switch to dark mode'}"]`)
})
