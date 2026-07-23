# Electron Shell Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working Electron + Vite + React + TypeScript desktop shell in the new `optimaclays_desktop` repo: a real window boots, shows a minimal status page, and the whole thing builds into a runnable Windows installer `.exe`. No business logic yet — this is Phase 1 of 6 from the [migration design spec](../specs/2026-07-23-electron-desktop-migration-design.md).

**Architecture:** `electron-vite` orchestrates three TypeScript build targets (main, preload, renderer) from one project. Main process boots a `BrowserWindow` with `contextIsolation`/`sandbox` on and `nodeIntegration` off. Preload exposes a minimal `window.api` surface via `contextBridge`. Renderer is a plain React app that reads that surface to prove the bridge works end to end. `electron-builder` packages the result into an NSIS installer.

**Tech Stack:** Electron 43, electron-vite 5, Vite 7, React 19, TypeScript 5.9, electron-builder 26, Playwright 1.61 (electron smoke test)

---

## File structure

```
optimaclays_desktop/
├── src/
│   ├── main/
│   │   └── index.ts          # app lifecycle, window creation
│   ├── preload/
│   │   ├── index.ts          # contextBridge, exposes window.api
│   │   └── index.d.ts        # types window.api for the renderer
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx      # React root
│           └── App.tsx       # status page
├── e2e/
│   └── app.spec.ts           # Playwright smoke test
├── electron.vite.config.ts
├── electron-builder.yml
├── playwright.config.ts
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
└── README.md
```

---

### Task 1: Project scaffold and build tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `electron.vite.config.ts`

- [ ] **Step 1: Create the feature branch**

Run: `git checkout -b feature/electron-shell main`
Expected: `Switched to a new branch 'feature/electron-shell'`

- [ ] **Step 2: Write package.json**

```json
{
  "name": "optima-clays-desktop",
  "version": "0.1.0",
  "description": "Optima Clays Ltd desktop business management system",
  "main": "./out/main/index.js",
  "author": "Optima Clays Ltd",
  "private": true,
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "electron-vite dev",
    "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
    "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "build": "npm run typecheck && electron-vite build",
    "build:win": "npm run build && electron-builder --win",
    "postinstall": "electron-builder install-app-deps",
    "test:e2e": "playwright test"
  },
  "dependencies": {},
  "devDependencies": {
    "@playwright/test": "^1.61.1",
    "@types/node": "^26.1.1",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.0",
    "electron": "^43.2.0",
    "electron-builder": "^26.15.3",
    "electron-vite": "^5.0.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "typescript": "^5.9.3",
    "vite": "^7.3.6"
  }
}
```

- [ ] **Step 3: Write tsconfig.json (root, project references only)**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

- [ ] **Step 4: Write tsconfig.node.json (main + preload)**

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["electron-vite/node", "node"],
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["electron.vite.config.ts", "src/main/**/*", "src/preload/**/*"]
}
```

- [ ] **Step 5: Write tsconfig.web.json (renderer)**

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["vite/client"]
  },
  "include": ["src/renderer/src/**/*", "src/preload/index.d.ts"]
}
```

- [ ] **Step 6: Write electron.vite.config.ts**

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react()]
  }
})
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: install completes with no errors, `node_modules/.bin/electron-vite` exists.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json tsconfig.web.json electron.vite.config.ts
git commit -m "chore: scaffold electron-vite project tooling"
```

---

### Task 2: Main process window bootstrap

**Files:**
- Create: `src/main/index.ts`

- [ ] **Step 1: Write src/main/index.ts**

```typescript
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null

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
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck:node`
Expected: exits with no errors (the `../preload/index.js` and `../renderer/index.html` paths are plain runtime strings, not compile-time imports, so this passes before those files exist).

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: boot electron main window with security hardening defaults"
```

---

### Task 3: Preload bridge

**Files:**
- Create: `src/preload/index.ts`
- Create: `src/preload/index.d.ts`

- [ ] **Step 1: Write src/preload/index.ts**

```typescript
import { contextBridge } from 'electron'

const api = {
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 2: Write src/preload/index.d.ts**

```typescript
export interface ExposedApi {
  versions: {
    node: string
    chrome: string
    electron: string
  }
}

declare global {
  interface Window {
    api: ExposedApi
  }
}
```

- [ ] **Step 3: Verify it typechecks**

Run: `npm run typecheck:node`
Expected: exits with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: expose versions api via contextBridge preload"
```

---

### Task 4: Renderer shell

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`

- [ ] **Step 1: Write src/renderer/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    />
    <title>Optima Clays</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Write src/renderer/src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: Write src/renderer/src/App.tsx**

```tsx
export default function App(): JSX.Element {
  const { node, chrome, electron } = window.api.versions

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Optima Clays Desktop</h1>
      <p>Electron shell is running.</p>
      <ul>
        <li>Node {node}</li>
        <li>Chrome {chrome}</li>
        <li>Electron {electron}</li>
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Verify it typechecks**

Run: `npm run typecheck:web`
Expected: exits with no errors (`window.api` resolves via `src/preload/index.d.ts`, included in `tsconfig.web.json`).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/index.html src/renderer/src/main.tsx src/renderer/src/App.tsx
git commit -m "feat: add renderer shell displaying electron shell status"
```

---

### Task 5: Build verification and Playwright smoke test

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/app.spec.ts`

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: typecheck passes, then electron-vite reports building main, preload, and renderer, producing `out/main/index.js`, `out/preload/index.js`, `out/renderer/index.html`.

- [ ] **Step 2: Write playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0
})
```

- [ ] **Step 3: Write e2e/app.spec.ts**

```typescript
import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'

test('main window shows the Optima Clays shell', async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'out', 'main', 'index.js')]
  })
  const window = await app.firstWindow()
  await window.waitForSelector('h1')
  const heading = await window.textContent('h1')
  expect(heading).toBe('Optima Clays Desktop')
  await app.close()
})
```

- [ ] **Step 4: Run the smoke test**

Run: `npx playwright test`
Expected: `1 passed`

- [ ] **Step 5: Manually verify dev mode (documented, not automated)**

Run: `npm run dev`
Expected: a window opens titled "Optima Clays" showing the heading "Optima Clays Desktop" and the Node/Chrome/Electron version list. Stop it with Ctrl+C once confirmed.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/app.spec.ts
git commit -m "test: add electron smoke test verifying the main window boots"
```

---

### Task 6: Packaging config and first installer build

**Files:**
- Create: `electron-builder.yml`

- [ ] **Step 1: Write electron-builder.yml**

```yaml
appId: rw.co.optimaclays.desktop
productName: Optima Clays
directories:
  output: release
  buildResources: build
files:
  - out/**/*
  - package.json
asarUnpack:
  - '**/*.node'
win:
  target: nsis
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

- [ ] **Step 2: Build the Windows installer**

Run: `npm run build:win`
Expected: completes with an NSIS installer written to `release/`, e.g. `release/Optima Clays Setup 0.1.0.exe`.

- [ ] **Step 3: Commit**

```bash
git add electron-builder.yml
git commit -m "chore: add electron-builder packaging config for windows"
```

---

### Task 7: README and PR

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# Optima Clays Desktop

Desktop business management system for Optima Clays Ltd, built with Electron, React, TypeScript, and SQLite. This replaces the web version of the same system with a standalone Windows app.

Design spec: `docs/superpowers/specs/2026-07-23-electron-desktop-migration-design.md`

## Status

Phase 1 of 6: Electron shell scaffold. Boots a window and proves the build/package pipeline works. No business logic yet.

## Development

    npm install
    npm run dev

## Build

    npm run build        # typecheck + compile main/preload/renderer
    npm run build:win     # build + package a Windows installer into release/

## Testing

    npm run test:e2e
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add project readme"
```

- [ ] **Step 3: Push the branch**

Run: `git push -u origin feature/electron-shell`
Expected: branch pushed to `https://github.com/tuyisengeaurele/optimaclays_desktop`

- [ ] **Step 4: Open the PR**

```bash
gh pr create --title "Electron shell scaffold" --body "$(cat <<'EOF'
Phase 1 of the desktop migration (see docs/superpowers/specs/2026-07-23-electron-desktop-migration-design.md).

Sets up the electron-vite + React + TypeScript project, boots a window with
security hardening defaults on, and packages a first runnable Windows installer.
No business logic yet, that comes in later phases.

Verified locally: typecheck, electron-vite build, playwright smoke test, and
electron-builder --win all pass.
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 5: Merge once verified**

Run: `gh pr merge --merge`
Expected: PR merged into `main` with a merge commit (no squash, keeps the small commits from Tasks 1-7 visible in history).

- [ ] **Step 6: Sync local main**

```bash
git checkout main
git pull origin main
```

---

## Self-review notes

- Every task from the Phase 1 spec scope (repo scaffold, main/preload, basic window, build tooling, electron-builder skeleton) has a task above; Task 6 goes slightly further than "skeleton" by actually producing a first `.exe`, which is a stronger, more honest verification than a skeleton config nobody's run.
- `window.api.versions` shape is identical across `src/preload/index.ts`, `src/preload/index.d.ts`, and `src/renderer/src/App.tsx` (`node`, `chrome`, `electron`).
- `sandbox: true` deliberately deviates from the common electron-vite boilerplate default (`sandbox: false`) — required by the approved security hardening design, not an oversight.
- No `@electron-toolkit/*` packages used; the two things they'd provide (`is.dev`, generic `electronAPI`) are replaced with a one-line `app.isPackaged` check and an explicit, minimal `window.api` surface, which is a smaller and more least-privilege footprint for a security-sensitive app.
