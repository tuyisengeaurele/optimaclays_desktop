import { writeFileSync } from 'fs'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import { registerAllHandlers } from './ipc/registerAll'
import { createSplashWindow } from './splash'
import { initializeDatabase } from './migrate'

const SPLASH_MIN_VISIBLE_MS = 1500

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let splashShownAt: number | null = null

function logFatalError(source: string, error: unknown): void {
  const details = error instanceof Error ? (error.stack ?? error.message) : String(error)
  const line = `${new Date().toISOString()} [${source}]\n${details}\n`
  try {
    writeFileSync(join(app.getPath('userData'), 'startup-error.log'), line, { flag: 'a' })
  } catch {
    // Best effort - if userData itself isn't writable, the dialog is all that's left.
  }
  dialog.showErrorBox('Optima Clays failed to start', `${source}:\n\n${details}`)
}

process.on('uncaughtException', (error) => logFatalError('uncaughtException', error))
process.on('unhandledRejection', (error) => logFatalError('unhandledRejection', error))

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    const elapsed = splashShownAt ? Date.now() - splashShownAt : SPLASH_MIN_VISIBLE_MS
    const remaining = Math.max(0, SPLASH_MIN_VISIBLE_MS - elapsed)
    setTimeout(() => {
      splashWindow?.close()
      splashWindow = null
      mainWindow?.show()
    }, remaining)
  })

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https:') || details.url.startsWith('http:')) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  splashWindow = createSplashWindow()
  splashShownAt = Date.now()

  // Dev mode uses its own migrate/seed npm scripts against prisma/dev.db via
  // the real prisma CLI, which isn't bundled into a packaged build. A fresh
  // install has no userData database at all, so the packaged app applies its
  // own bundled migrations and seeds the admin account on first launch.
  if (app.isPackaged) {
    try {
      await initializeDatabase()
    } catch (error) {
      logFatalError('The local database could not be prepared', error)
      app.quit()
      return
    }
  }

  registerAllHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
