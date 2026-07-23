import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'

test('main window shows the Optima Clays shell', async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'out', 'main', 'index.js')]
  })
  try {
    const window = await app.firstWindow()
    await window.waitForSelector('h1')
    const heading = await window.textContent('h1')
    expect(heading).toBe('Optima Clays Desktop')
  } finally {
    await app.close()
  }
})
