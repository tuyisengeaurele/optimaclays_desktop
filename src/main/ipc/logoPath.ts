import { join } from 'path'
import { app } from 'electron'

// Portable resolution for the bundled company logo, shared by every HTML-template handler
// that embeds it (payroll payslips, proforma invoices, delivery waybills). The desktop app
// keeps its copy at the repo root instead of alongside a bundled backend, unlike the source
// project's backend/assets/logo.png. Packaged-app resolution (resourcesPath) depends on
// Phase 6 adding logo.png to electron-builder's extraResources, which doesn't exist yet -
// this only resolves correctly in dev/unpackaged builds for now.
export const LOGO_PATH = app.isPackaged ? join(process.resourcesPath, 'logo.png') : join(__dirname, '../../logo.png')
