import { writeFile } from 'fs/promises'
import { BrowserWindow, dialog } from 'electron'
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
// bytes (Phase 6 wires up real PDF generation). This renders that HTML in an
// offscreen window and opens the OS print dialog against it - "Microsoft
// Print to PDF" works as a virtual printer if the user wants a file.
async function printHtml(html: string): Promise<void> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await printWindow.webContents.print({ silent: false })
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
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
