import { writeFile, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { app, BrowserWindow, dialog } from 'electron'
import { handle } from './handle'

interface PrintHtmlPayload {
  html: string
  filename: string
}

interface SaveBufferPayload {
  buffer: string
  filename: string
}

interface OpenFilePayload {
  title?: string
  extensions: string[]
}

// Payslip/proforma/waybill handlers hand back an HTML string rather than PDF
// bytes. This renders that HTML in an offscreen window and opens the OS
// print dialog against it - "Microsoft Print to PDF" works as a virtual
// printer if the user wants a file instead of a physical printout.
async function printHtml(html: string): Promise<void> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  printWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // loadURL with the html wrapped in a data: URL blows past a URL length
  // limit once the embedded logo's base64 image is counted too, and the
  // load fails silently - the same failure mode the splash screen hit.
  // A temp file sidesteps any size ceiling since it's a normal file://
  // navigation instead of one giant URL.
  const htmlPath = join(app.getPath('temp'), `optima-clays-print-${randomUUID()}.html`)
  try {
    await writeFile(htmlPath, html)
    await printWindow.loadFile(htmlPath)
    await printWindow.webContents.print({ silent: false })
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
    await unlink(htmlPath).catch(() => {})
  }
}

export function registerDialogHandlers(): void {
  handle<PrintHtmlPayload, null>(
    'dialogs:printHtml',
    null,
    async ({ html }) => {
      await printHtml(html)
      return null
    }
  )

  handle<SaveBufferPayload, { saved: boolean }>(
    'dialogs:saveBuffer',
    null,
    async ({ buffer, filename }) => {
      const focused = BrowserWindow.getFocusedWindow()
      const result = focused
        ? await dialog.showSaveDialog(focused, { defaultPath: filename })
        : await dialog.showSaveDialog({ defaultPath: filename })
      if (result.canceled || !result.filePath) return { saved: false }
      await writeFile(result.filePath, Buffer.from(buffer, 'base64'))
      return { saved: true }
    }
  )

  handle<OpenFilePayload, { filePath: string | null }>(
    'dialogs:openFile',
    null,
    async ({ extensions, title }) => {
      const focused = BrowserWindow.getFocusedWindow()
      const options: Electron.OpenDialogOptions = {
        title,
        filters: [{ name: 'Import file', extensions }],
        properties: ['openFile']
      }
      const result = focused ? await dialog.showOpenDialog(focused, options) : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return { filePath: null }
      return { filePath: result.filePaths[0] }
    }
  )
}
