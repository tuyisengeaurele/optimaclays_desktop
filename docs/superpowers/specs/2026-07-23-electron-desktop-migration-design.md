# Optima Clays Desktop — Electron Migration Design

Date: 2026-07-23
Status: Approved, ready for implementation planning

## Goal

Turn the existing Optima Clays Business Management System (React + Express + Prisma/PostgreSQL, at `optimaclaysltd/optima-clays`) into a standalone Windows desktop app, packaged as an installable `.exe`, using Electron and a local SQLite database. Same business functionality, same roles, same pages. New: native window, splash screen, offline single-machine storage, no network listener.

Source project reference: `C:\Users\user\OneDrive\Documents\Projects\Web\optimaclaysltd\optima-clays`
New repo: `https://github.com/tuyisengeaurele/optimaclays_desktop` (currently empty)

## Non-goals

- No multi-machine sync or cloud backend. One SQLite file per install.
- No auto-update mechanism (not requested).
- No code signing (internal company tool; SmartScreen warning on first run is accepted).
- No new business features. This is a platform migration, not a feature project.
- No macOS/Linux builds. Windows only, per the requested `.exe`.

## Target architecture

```
Electron app
├── main process
│   ├── window management (splash window -> main window)
│   ├── SQLite init (Prisma Client, migrate + seed on first run)
│   ├── session store (in-memory token -> {userId, role, expiresAt})
│   ├── ipcMain.handle(...) per resource, ported from current controllers
│   └── native dialogs (save/open) for exports, imports, print
├── preload (contextBridge)
│   └── window.api.{auth,employees,attendance,payroll,production,...}
└── renderer (existing React app, ported as-is)
    ├── HashRouter instead of BrowserRouter
    ├── services/ layer swapped: axios calls -> window.api.* IPC calls
    └── all 25 pages, components, business rules unchanged
```

No HTTP server, no open port, no CORS surface. Renderer never gets Node or filesystem access directly; every action goes through a named, typed IPC channel that main validates and authorizes.

## Data layer

Provider changes from `postgresql` to `sqlite`, using `prisma@6.19.3` with the standard `prisma-client-js` generator (verified directly: generates to `node_modules/@prisma/client`, imported the normal way, `.env`/`DATABASE_URL` loading works with no extra setup). Prisma 7 exists but changes the generator to a project-local TS-first client that would need extra bundling work for no benefit here, so this project deliberately stays on the 6.x line.

**Enums (16 total) stay as native Prisma `enum` blocks**, unchanged from the original schema. Verified directly: SQLite gained enum and JSON support in Prisma 6.2.0+, storing enum values as a `TEXT` column with the default enforced at the column level and valid-value enforcement handled by Prisma Client rather than a DB constraint. This is strictly better than the plain-`String` fallback originally planned here, since it keeps generated TypeScript types and autocomplete for `Role, WageType, PaymentStatus, AttendanceStatus, Shift, ProductionStage, MaterialType, BrickType, QualityGrade, CustomerType, OrderStatus, PaymentMethod, DeliveryStatus, KilnStatus, DefectType, RejectDisposition`.

**Array fields become normalized child tables** (per approved decision):
- `User.pinned_kpis` (String[]) -> `UserPinnedKpi { id, userId, kpi }`
- `Supplier.material_types` (String[]) -> `SupplierMaterialType { id, supplierId, materialType }`
- `ProductionBatch.defect_types` (DefectType[]) -> `ProductionBatchDefectType { id, productionBatchId, defectType }`

Each gets a small repository helper so callers still work with `string[]` in and out; the join-table plumbing is internal.

All 27 models carry over with these two adjustments; relations, unique constraints, and defaults stay the same.

**Startup sequence:** DB file lives at `app.getPath('userData')/optimaclays.db`. On first launch, run Prisma migrations against that file, then check if `User` is empty and seed the admin account:
- Email: `admin@optimaclays.rw`
- Password: `Admin@1234` (matches the live web system; the request text said `admin@1234` but the existing README/seed both use capital A — using that unless corrected)

## IPC API surface

One `ipcMain.handle` per current route, same resource grouping, so each of the ~23 controllers maps to one handler module:

`auth, employees, attendance, payroll, production, kilns, inventory, suppliers, reconciliation, customers, orders, priceCatalogue, invoices, proformas, payments, deliveries, expenses, expenseCategories, reports, dashboard, settings, users, audit, notifications, import`

Every handler:
1. Reads the session token passed from the renderer (attached automatically by a preload wrapper, mirroring how axios previously attached the JWT cookie).
2. Validates it against the in-memory session map, checks expiry and role against the route's allowed roles (same role table as today).
3. Validates the payload with the existing Zod schema.
4. Runs the same Prisma logic the controller ran, minus Express-specific code.
5. Returns `{ ok: true, data }` or `{ ok: false, code, message }`. The preload/renderer client unwraps this into a thrown `Error` on failure, so TanStack Query's existing error handling in the frontend needs no rework.

## Auth & session

- Login: renderer sends email + password over `auth:login`. Main verifies the bcrypt hash (12 rounds, unchanged) against SQLite, issues a random session token (`crypto.randomBytes(32)`), stores it in an in-memory `Map<token, {userId, role, expiresAt}>`.
- Token lives only in main-process memory. Renderer holds it in memory too (React auth context), never in localStorage or on disk.
- Every IPC call carries the token; `auth:logout` and app restart both clear it. No "remember me" persistence, per approved decision.
- Role-gated access stays identical to today's five roles: `ADMIN, PRODUCTION_SUPERVISOR, SALES_OFFICER, STORE_MANAGER, ACCOUNTANT`.

## Printing, exports, imports

- Puppeteer is dropped. Proforma/payslip PDF generation and print output move to Electron's native `webContents.printToPDF()` / `.print()`, run against the same HTML templates in a hidden `BrowserWindow`. Removes a ~300MB bundled Chromium that duplicated Electron's own.
- Excel exports (payroll, reports) and CSV/Excel bulk import move from browser download / multipart upload to native `dialog.showSaveDialog` / `dialog.showOpenDialog`, with main process reading/writing the file directly.

## UI: splash screen and sidebar

- **Splash:** frameless, undecorated `BrowserWindow` (~420x280), centered, `alwaysOnTop`, `skipTaskbar`. Shows the company logo on the brand cream background (`#F5F0EB`) with a subtle loading indicator. Created first; main window is built hidden (`show: false`) and shown via `ready-to-show`, at which point splash closes. No minimum-timer padding, no progress text, per approved choice — it just disappears as soon as the app is ready.
- **Sidebar:** keeps the current six domain groups (People & HR, Production, Inventory, Sales, Finance, System) since they already map cleanly to the business. Restyled for a native desktop feel: refined active-state indicator, tighter spacing/typography, small pinned/favorites row at the top. No structural regrouping.

## Security hardening

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` in every `BrowserWindow`.
- `contextBridge` exposes only the named `window.api.*` methods, nothing else.
- Strict CSP (`script-src 'self'`, no `unsafe-inline`/`unsafe-eval`) since there are no external scripts or fetches at all.
- `will-navigate` and `setWindowOpenHandler` both blocked/restricted; the app never needs to navigate anywhere external.
- No HTTP listener anywhere in the process, closing off CORS/network attack surface entirely.
- Passwords never leave the main process; bcrypt stays at 12 rounds.

## Packaging

- `electron-builder`, Windows target `nsis`.
- Output: `Optima Clays Setup <version>.exe`, installs to Program Files, Start Menu shortcut.
- `asarUnpack` covers Prisma's SQLite query engine binary and any other native (`.node`) modules — required, since native binaries can't execute from inside an asar archive.
- App icon converted from `logo.png` to `.ico`.
- Unsigned build; Windows SmartScreen warning on first run is expected and accepted for this internal tool.

## Delivery plan: six sequential PRs into `main`

1. **`feature/electron-shell`** — repo scaffold (main/preload/renderer folders), Electron main process boots a basic window, build tooling (TypeScript configs, npm scripts), electron-builder config skeleton.
2. **`feature/sqlite-schema`** — Prisma schema converted to SQLite (enums to String, arrays to child tables), migrations, seed script with the admin user, verified standalone via a small script before any UI wiring.
3. **`feature/ipc-backend`** — all ~23 resource handlers ported from the existing controllers, session/auth model, preload API surface.
4. **`feature/frontend-rewire`** — services layer swapped from axios to `window.api.*`, `HashRouter` in place of `BrowserRouter`, native save/open dialogs wired for print/export/import, login flow wired to the new session model.
5. **`feature/splash-sidebar-polish`** — splash screen, sidebar restyle, and a full copy pass across the app for human-toned text (no em dashes or AI-tell phrasing anywhere, matching the standing project rule).
6. **`feature/security-packaging`** — Electron security checklist applied and verified, Puppeteer removed in favor of native `printToPDF`, electron-builder finalized, first runnable `.exe` produced and smoke-tested.

Each branch gets its own PR against `main` on `tuyisengeaurele/optimaclays_desktop`, with commit messages in the existing project style (lowercase conventional prefixes, terse, specific, no AI co-author attribution). Merged once the phase builds and its feature is verified working.

## Risks / things to verify during implementation

- Exact Prisma + Electron + asar packaging steps (binary targets, `extraResources` vs `asarUnpack`) need hands-on verification once scaffolding starts; documented approach above is the standard pattern but Prisma version specifics may need adjustment.
- `better-sqlite3`/Prisma engine native module must be rebuilt against Electron's Node ABI (`electron-rebuild` or `@electron/rebuild`), not the system Node ABI.
- Puppeteer removal needs a visual diff check against current PDF/print output to confirm `printToPDF` renders the existing HTML templates identically enough (fonts, page breaks, header/footer).
