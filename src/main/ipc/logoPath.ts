import { join } from 'path'
import { app } from 'electron'

// Portable resolution for the bundled company logo, shared by every HTML-template handler
// that embeds it (payroll payslips, proforma invoices, delivery waybills) and by the splash
// window. The desktop app keeps its copy at the repo root instead of alongside a bundled
// backend, unlike the source project's backend/assets/logo.png. electron-builder.yml copies
// it into extraResources, so it lands next to resourcesPath in a packaged build.
export const LOGO_PATH = app.isPackaged ? join(process.resourcesPath, 'logo.png') : join(__dirname, '../../logo.png')
