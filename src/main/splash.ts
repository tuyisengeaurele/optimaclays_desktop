import { readFileSync } from 'fs'
import { BrowserWindow } from 'electron'
import { LOGO_PATH } from './ipc/logoPath'

function splashHtml(): string {
  // The splash page loads via a data: URL, which gets an opaque origin - a
  // file:// image reference gets blocked as a local-resource load from a
  // non-file origin, so the logo is inlined as base64 instead, the same way
  // the payslip/proforma/waybill templates already embed it.
  const logoBase64 = readFileSync(LOGO_PATH).toString('base64')
  const logoUrl = `data:image/png;base64,${logoBase64}`
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0;
    height: 100%;
    background: #F5F0EB;
    overflow: hidden;
  }
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: Arial, sans-serif;
  }
  img {
    width: 150px;
    height: auto;
    object-fit: contain;
    margin-bottom: 28px;
  }
  .dots {
    display: flex;
    gap: 7px;
  }
  .dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #C0392B;
    animation: pulse 1.2s ease-in-out infinite;
  }
  .dots span:nth-child(2) { animation-delay: 0.2s; }
  .dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse {
    0%, 80%, 100% { opacity: 0.25; transform: scale(0.75); }
    40% { opacity: 1; transform: scale(1); }
  }
</style>
</head>
<body>
  <img src="${logoUrl}" alt="Optima Clays Ltd" />
  <div class="dots"><span></span><span></span><span></span></div>
</body>
</html>`
}

export function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#F5F0EB',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  splash.webContents.on('will-navigate', (event) => event.preventDefault())
  splash.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  splash.once('ready-to-show', () => splash.show())
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml())}`)

  return splash
}
