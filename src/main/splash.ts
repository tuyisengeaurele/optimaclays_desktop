import { writeFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { app, BrowserWindow } from 'electron'
import { LOGO_PATH } from './ipc/logoPath'

function splashHtml(): string {
  // The page itself loads via file:// (loadFile), so a plain file:// image
  // reference works with no restriction, unlike a data: URL page (an
  // earlier version of this file tried inlining the logo as base64 into a
  // data: URL, but the whole page - HTML plus a multi-megabyte encoded
  // image - blew past a URL length limit and the load silently failed,
  // leaving a blank window).
  const logoUrl = pathToFileURL(LOGO_PATH).toString()
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

export interface SplashHandle {
  window: BrowserWindow
  // Resolves only once the window has actually called .show(), so callers
  // can time a minimum-visible duration from when it's truly on screen
  // rather than from when the BrowserWindow object was merely created.
  shown: Promise<void>
}

export function createSplashWindow(): SplashHandle {
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

  const shown = new Promise<void>((resolve) => {
    let resolved = false
    const resolveOnce = (): void => {
      if (resolved) return
      resolved = true
      resolve()
    }
    splash.once('ready-to-show', () => {
      splash.show()
      resolveOnce()
    })
    // App startup waits on this promise, so a fallback keeps a rendering
    // hiccup on this static, local page from ever hanging the whole app.
    setTimeout(() => {
      if (!splash.isDestroyed() && !splash.isVisible()) splash.show()
      resolveOnce()
    }, 2000)
  })

  const htmlPath = join(app.getPath('temp'), 'optima-clays-splash.html')
  writeFileSync(htmlPath, splashHtml())
  splash.loadFile(htmlPath)

  return { window: splash, shown }
}
