import { writeFile, unlink, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { app, BrowserWindow, dialog } from 'electron'
import { handle } from './handle'

interface DownloadPdfPayload {
  html: string
  filename: string
  category: string
}

interface SaveBufferPayload {
  buffer: string
  filename: string
  category: string
}

interface OpenFilePayload {
  title?: string
  extensions: string[]
}

// Generated files land under a per-document-type folder inside the user's
// own Documents folder by default - always writable, no admin rights
// needed, unlike the app's own install directory. The save dialog still
// lets the user redirect anywhere else.
async function resolveDefaultSavePath(category: string, filename: string): Promise<string> {
  const dir = join(app.getPath('documents'), 'Optima Clays', category)
  await mkdir(dir, { recursive: true })
  return join(dir, filename)
}

// Payslip/proforma/waybill handlers hand back an HTML string rather than PDF
// bytes. This renders that HTML in an offscreen window and turns it into a
// real PDF via Electron's own printToPDF, then hands the bytes to a native
// save dialog - the earlier version opened the OS print dialog instead and
// relied on the user manually choosing "Microsoft Print to PDF", which
// didn't read as a working download.
async function renderPdf(html: string): Promise<Buffer> {
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
  const htmlPath = join(app.getPath('temp'), `optima-clays-pdf-${randomUUID()}.html`)
  try {
    await writeFile(htmlPath, html)
    await printWindow.loadFile(htmlPath)
    return await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4' })
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
    await unlink(htmlPath).catch(() => {})
  }
}

export function registerDialogHandlers(): void {
  handle<DownloadPdfPayload, { saved: boolean; filePath: string | null }>(
    'dialogs:downloadPdf',
    null,
    async ({ html, filename, category }) => {
      const pdfBuffer = await renderPdf(html)
      const defaultPath = await resolveDefaultSavePath(category, filename)
      const focused = BrowserWindow.getFocusedWindow()
      const options = { defaultPath, filters: [{ name: 'PDF', extensions: ['pdf'] }] }
      const result = focused ? await dialog.showSaveDialog(focused, options) : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return { saved: false, filePath: null }
      await writeFile(result.filePath, pdfBuffer)
      return { saved: true, filePath: result.filePath }
    }
  )

  handle<SaveBufferPayload, { saved: boolean; filePath: string | null }>(
    'dialogs:saveBuffer',
    null,
    async ({ buffer, filename, category }) => {
      const defaultPath = await resolveDefaultSavePath(category, filename)
      const focused = BrowserWindow.getFocusedWindow()
      const result = focused
        ? await dialog.showSaveDialog(focused, { defaultPath })
        : await dialog.showSaveDialog({ defaultPath })
      if (result.canceled || !result.filePath) return { saved: false, filePath: null }
      await writeFile(result.filePath, Buffer.from(buffer, 'base64'))
      return { saved: true, filePath: result.filePath }
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
