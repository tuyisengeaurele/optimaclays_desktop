import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

// The app now opens a splash window before the main window, so the first
// window Electron creates is the splash, not the page tests need. Find the
// window whose URL isn't the splash's temp html file instead of assuming
// it's first.
function isSplashWindow(url: string): boolean {
  return url.includes('optima-clays-splash')
}

export async function launchApp(): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({ args: [path.join(__dirname, '..', 'out', 'main', 'index.js')] })
  let window = app.windows().find((page) => !isSplashWindow(page.url()))
  if (!window) {
    window = await app.waitForEvent('window', (page) => !isSplashWindow(page.url()))
  }
  await window.waitForLoadState('domcontentloaded')
  return { app, window }
}
