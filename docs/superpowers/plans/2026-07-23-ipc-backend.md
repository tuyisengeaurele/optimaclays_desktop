# IPC Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port all business logic from the source web app's 23 Express controllers into IPC handlers running in the Electron main process, with a session-based auth model replacing JWT cookies. Phase 3 of 6 from the [migration design spec](../specs/2026-07-23-electron-desktop-migration-design.md). No renderer/UI wiring yet — that's Phase 4.

**Architecture:** One `ipcMain.handle` per current Express route, grouped into per-domain handler modules under `src/main/ipc/`. Every handler goes through a shared `handle()`/`handlePublic()` wrapper that checks the session token, enforces role gates (mirroring the source project's `authorize(...)` middleware exactly), validates the payload, and returns a typed `{ ok, data }` / `{ ok, code, message }` envelope. The three child tables from Phase 2 (`UserPinnedKpi`, `SupplierMaterialType`, `ProductionBatchDefectType`) get a small repository helper each, so handler code works with plain `string[]` the way the original Postgres array columns did.

**Source of truth for business logic:** `C:\Users\user\OneDrive\Documents\Projects\Web\optimaclaysltd\optima-clays\backend\src\controllers\*.ts` and `routes\*.ts`. Every task below either fully specifies the code (Tasks 1-2, novel infrastructure with no prior art in this repo) or gives an exact channel/role mapping table plus the precise source file(s) to port from (Tasks 3-6, mechanical translation of existing, complete business logic). "Port from source" means: read the named controller file in full, translate its Prisma queries and validation rules into the handler pattern established in Task 2, adapting only what's Express-specific (`req`/`res`/cookies/`req.params`) to the IPC equivalent (payload object, thrown `AppError`s, no `params` — IDs travel in the payload). Business rules, validation messages, and Prisma query shapes carry over unchanged unless a task explicitly says otherwise.

**Deferred to later phases (noted per-task where relevant):**
- PDF rendering (payslip/proforma/waybill "print" actions): Phase 3 handlers return the assembled HTML string + a suggested filename, not actual PDF bytes. Puppeteer is not introduced (the design spec drops it entirely in favor of Electron's native `printToPDF`, wired in Phase 6). Turning that HTML into a saved PDF file is Phase 6's job.
- Native save/open dialogs for exports and imports: Phase 3 handlers return structured data (or a base64 buffer for CSV/XLSX exports); wiring a `dialog.showSaveDialog`/`showOpenDialog` call to actually write/read the file is Phase 4's job.

**Tech Stack:** Same dependencies as Phase 2 (`@prisma/client`, `bcryptjs`), plus `exceljs` and `@fast-csv/format` (ported from the source backend's `package.json`, needed for the payroll/report export handlers in Tasks 3 and 6).

---

## File structure

```
src/main/
├── ipc/
│   ├── types.ts              # IpcResult<T>, Session, Role
│   ├── errors.ts             # AppError and subclasses
│   ├── session.ts            # in-memory session store
│   ├── handle.ts             # handle()/handlePublic() wrappers
│   ├── repositories/
│   │   ├── pinnedKpis.ts     # string[] <-> UserPinnedKpi helper
│   │   ├── materialTypes.ts  # string[] <-> SupplierMaterialType helper
│   │   └── defectTypes.ts    # string[] <-> ProductionBatchDefectType helper
│   ├── auth.ts                    # Task 2
│   ├── employees.ts               # Task 3
│   ├── attendance.ts               # Task 3
│   ├── payroll.ts                  # Task 3
│   ├── production.ts               # Task 4
│   ├── kilns.ts                     # Task 4
│   ├── inventory.ts                 # Task 4
│   ├── suppliers.ts                 # Task 4
│   ├── reconciliation.ts            # Task 4
│   ├── customers.ts                 # Task 5
│   ├── orders.ts                    # Task 5
│   ├── priceCatalogue.ts            # Task 5
│   ├── invoices.ts                  # Task 5
│   ├── proformas.ts                 # Task 5
│   ├── payments.ts                  # Task 5
│   ├── deliveries.ts                # Task 5
│   ├── expenses.ts                  # Task 6
│   ├── expenseCategories.ts         # Task 6
│   ├── reports.ts                   # Task 6
│   ├── dashboard.ts                 # Task 6
│   ├── settings.ts                  # Task 6
│   ├── audit.ts                     # Task 6
│   ├── notifications.ts             # Task 6
│   ├── import.ts                    # Task 6
│   └── registerAll.ts        # calls every domain's register function
├── db.ts                     # PrismaClient singleton, dev-mode db path
└── index.ts                  # modified: calls registerAll() on startup
```

---

### Task 1: Core IPC infrastructure

**Files:**
- Create: `src/main/db.ts`
- Create: `src/main/ipc/types.ts`
- Create: `src/main/ipc/errors.ts`
- Create: `src/main/ipc/session.ts`
- Create: `src/main/ipc/handle.ts`
- Create: `src/main/ipc/repositories/pinnedKpis.ts`
- Create: `src/main/ipc/repositories/materialTypes.ts`
- Create: `src/main/ipc/repositories/defectTypes.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `package.json` (move `@prisma/client`/`bcryptjs` usage into the Electron app — they're already dependencies from Phase 2, no version change needed)

- [ ] **Step 1: Create the feature branch**

Run: `git checkout -b feature/ipc-backend main`

- [ ] **Step 2: Write src/main/db.ts**

```typescript
import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import { join } from 'path'

const dbPath = app.isPackaged
  ? join(app.getPath('userData'), 'optimaclays.db')
  : join(__dirname, '../../prisma/dev.db')

export const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } }
})
```

- [ ] **Step 3: Write src/main/ipc/types.ts**

```typescript
export type Role = 'ADMIN' | 'PRODUCTION_SUPERVISOR' | 'SALES_OFFICER' | 'STORE_MANAGER' | 'ACCOUNTANT'

export type IpcResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string }

export interface SessionInfo {
  userId: string
  email: string
  role: Role
}
```

- [ ] **Step 4: Write src/main/ipc/errors.ts**

```typescript
export class AppError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHENTICATED', message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message)
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super('BAD_REQUEST', message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message)
  }
}
```

- [ ] **Step 5: Write src/main/ipc/session.ts**

```typescript
import { randomBytes } from 'crypto'
import type { Role, SessionInfo } from './types'

interface StoredSession extends SessionInfo {
  expiresAt: number
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000

const sessions = new Map<string, StoredSession>()

export function createSession(userId: string, email: string, role: Role): string {
  const token = randomBytes(32).toString('hex')
  sessions.set(token, { userId, email, role, expiresAt: Date.now() + SESSION_TTL_MS })
  return token
}

export function getSession(token: string | undefined | null): SessionInfo | null {
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }
  return { userId: session.userId, email: session.email, role: session.role }
}

export function destroySession(token: string): void {
  sessions.delete(token)
}
```

- [ ] **Step 6: Write src/main/ipc/handle.ts**

```typescript
import { ipcMain } from 'electron'
import { getSession } from './session'
import { AppError, AuthError, ForbiddenError } from './errors'
import type { IpcResult, Role, SessionInfo } from './types'

interface Envelope<TPayload> {
  token: string | null
  payload: TPayload
}

async function run<TResult>(channel: string, fn: () => Promise<TResult>): Promise<IpcResult<TResult>> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, code: error.code, message: error.message }
    }
    console.error(`[ipc:${channel}]`, error)
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Something went wrong' }
  }
}

export function handle<TPayload, TResult>(
  channel: string,
  allowedRoles: Role[] | null,
  fn: (payload: TPayload, session: SessionInfo) => Promise<TResult>
): void {
  ipcMain.handle(channel, (_event, envelope: Envelope<TPayload>) =>
    run(channel, async () => {
      const session = getSession(envelope?.token)
      if (!session) throw new AuthError()
      if (allowedRoles && !allowedRoles.includes(session.role)) throw new ForbiddenError()
      return fn(envelope.payload, session)
    })
  )
}

export function handlePublic<TPayload, TResult>(
  channel: string,
  fn: (payload: TPayload) => Promise<TResult>
): void {
  ipcMain.handle(channel, (_event, payload: TPayload) => run(channel, () => fn(payload)))
}
```

- [ ] **Step 7: Write src/main/ipc/repositories/pinnedKpis.ts**

```typescript
import { prisma } from '../../db'

export async function getPinnedKpis(userId: string): Promise<string[]> {
  const rows = await prisma.userPinnedKpi.findMany({ where: { userId } })
  return rows.map((row) => row.kpi)
}

export async function setPinnedKpis(userId: string, kpis: string[]): Promise<string[]> {
  await prisma.userPinnedKpi.deleteMany({ where: { userId } })
  const unique = Array.from(new Set(kpis))
  if (unique.length > 0) {
    await prisma.userPinnedKpi.createMany({ data: unique.map((kpi) => ({ userId, kpi })) })
  }
  return unique
}
```

- [ ] **Step 8: Write src/main/ipc/repositories/materialTypes.ts**

```typescript
import type { MaterialType } from '@prisma/client'
import { prisma } from '../../db'

export async function getMaterialTypes(supplierId: string): Promise<MaterialType[]> {
  const rows = await prisma.supplierMaterialType.findMany({ where: { supplierId } })
  return rows.map((row) => row.materialType)
}

export async function setMaterialTypes(supplierId: string, materialTypes: MaterialType[]): Promise<MaterialType[]> {
  await prisma.supplierMaterialType.deleteMany({ where: { supplierId } })
  const unique = Array.from(new Set(materialTypes))
  if (unique.length > 0) {
    await prisma.supplierMaterialType.createMany({ data: unique.map((materialType) => ({ supplierId, materialType })) })
  }
  return unique
}
```

- [ ] **Step 9: Write src/main/ipc/repositories/defectTypes.ts**

```typescript
import type { DefectType } from '@prisma/client'
import { prisma } from '../../db'

export async function getDefectTypes(productionBatchId: string): Promise<DefectType[]> {
  const rows = await prisma.productionBatchDefectType.findMany({ where: { productionBatchId } })
  return rows.map((row) => row.defectType)
}

export async function setDefectTypes(productionBatchId: string, defectTypes: DefectType[]): Promise<DefectType[]> {
  await prisma.productionBatchDefectType.deleteMany({ where: { productionBatchId } })
  const unique = Array.from(new Set(defectTypes))
  if (unique.length > 0) {
    await prisma.productionBatchDefectType.createMany({ data: unique.map((defectType) => ({ productionBatchId, defectType })) })
  }
  return unique
}
```

- [ ] **Step 10: Update src/preload/index.ts to add a token-aware invoke wrapper**

Replace the file's full content with:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

let currentToken: string | null = null

function setToken(token: string | null): void {
  currentToken = token
}

async function invoke<TPayload, TResult>(channel: string, payload: TPayload): Promise<TResult> {
  const result = await ipcRenderer.invoke(channel, { token: currentToken, payload })
  if (!result.ok) throw new Error(result.message)
  return result.data
}

async function invokePublic<TPayload, TResult>(channel: string, payload: TPayload): Promise<TResult> {
  const result = await ipcRenderer.invoke(channel, payload)
  if (!result.ok) throw new Error(result.message)
  return result.data
}

const api = {
  setToken,
  invoke,
  invokePublic,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
```

This is a deliberately generic bridge (`invoke`/`invokePublic` take any channel name), which differs from Phase 1's "one named method per action" ideal. It's the pragmatic middle ground for a 23-domain port: every domain-specific method (`window.api.employees.list()`, etc.) gets added on the *renderer* side in Phase 4 as a thin wrapper around `window.api.invoke('employees:list', payload)`, keeping the preload itself small while still never exposing raw `ipcRenderer` or any Node capability beyond these two functions.

- [ ] **Step 11: Update src/preload/index.d.ts**

```typescript
export interface ExposedApi {
  setToken: (token: string | null) => void
  invoke: <TPayload, TResult>(channel: string, payload: TPayload) => Promise<TResult>
  invokePublic: <TPayload, TResult>(channel: string, payload: TPayload) => Promise<TResult>
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

- [ ] **Step 12: Verify it typechecks**

Run: `npm run typecheck:node`
Expected: no errors. (`typecheck:web` will now fail because `src/renderer/src/App.tsx` still calls `window.api.versions` the old way — that's fine, App.tsx isn't touched until Phase 4. Don't fix `typecheck:web` in this task.)

- [ ] **Step 13: Commit**

```bash
git add src/main/db.ts src/main/ipc/types.ts src/main/ipc/errors.ts src/main/ipc/session.ts src/main/ipc/handle.ts src/main/ipc/repositories/pinnedKpis.ts src/main/ipc/repositories/materialTypes.ts src/main/ipc/repositories/defectTypes.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: add ipc session/error infrastructure and child-table repositories"
```

---

### Task 2: Auth and Users domain (reference implementation)

**Files:**
- Create: `src/main/ipc/auth.ts`
- Create: `src/main/ipc/registerAll.ts`
- Modify: `src/main/index.ts`

Source: `backend/src/controllers/authController.ts`, `backend/src/routes/authRoutes.ts`, `backend/src/middleware/auth.ts` (all in the source web project at `C:\Users\user\OneDrive\Documents\Projects\Web\optimaclaysltd\optima-clays`).

**Channel map** (mirrors `authRoutes.ts` exactly; `null` role list = any authenticated user, `PUBLIC` = no auth required):

| Channel | Source function | Roles |
|---|---|---|
| `auth:login` | `login` | PUBLIC |
| `auth:logout` | `logout` | any authenticated |
| `auth:profile` | `getProfile` | any authenticated |
| `auth:changePassword` | `changePassword` | any authenticated |
| `auth:updateProfile` | `updateProfile` | any authenticated |
| `auth:listUsers` | `listUsers` | ADMIN |
| `auth:createUser` | `createUser` | ADMIN |
| `auth:updateUser` | `updateUser` | ADMIN |

Note: `refresh` has no IPC equivalent — there's no access/refresh token split anymore, just one session token that lives until logout or the 12-hour TTL in `session.ts`. Drop it entirely, don't port a no-op.

- [ ] **Step 1: Write src/main/ipc/auth.ts**

```typescript
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { createSession, destroySession } from './session'
import { handle, handlePublic } from './handle'
import { AuthError, BadRequestError } from './errors'
import type { Role } from './types'
import { getPinnedKpis } from './repositories/pinnedKpis'

const BCRYPT_ROUNDS = 12

function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter'
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
  return null
}

interface LoginPayload {
  email: string
  password: string
}

interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

interface UpdateProfilePayload {
  full_name?: string
  email?: string
}

interface CreateUserPayload {
  email: string
  password: string
  full_name: string
  role: Role
}

interface UpdateUserPayload {
  id: string
  full_name?: string
  role?: Role
  is_active?: boolean
  password?: string
}

export function registerAuthHandlers(): void {
  handlePublic<LoginPayload, { token: string; user: { id: string; email: string; full_name: string; role: Role } }>(
    'auth:login',
    async ({ email, password }) => {
      if (!email || !password) throw new BadRequestError('Email and password required')
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user || !user.is_active) throw new AuthError('Invalid credentials')
      const valid = await bcrypt.compare(password, user.password)
      if (!valid) throw new AuthError('Invalid credentials')
      const token = createSession(user.id, user.email, user.role)
      return { token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } }
    }
  )

  handle<{ token: string }, null>('auth:logout', null, async (payload) => {
    destroySession(payload.token)
    return null
  })

  handle<void, { id: string; email: string; full_name: string; role: Role; pinnedKpis: string[] }>(
    'auth:profile',
    null,
    async (_payload, session) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } })
      const pinnedKpis = await getPinnedKpis(user.id)
      return { id: user.id, email: user.email, full_name: user.full_name, role: user.role, pinnedKpis }
    }
  )

  handle<ChangePasswordPayload, null>('auth:changePassword', null, async ({ currentPassword, newPassword }, session) => {
    const strengthError = validatePasswordStrength(newPassword)
    if (strengthError) throw new BadRequestError(strengthError)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } })
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) throw new BadRequestError('Current password is incorrect')
    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await prisma.user.update({ where: { id: session.userId }, data: { password: hashed } })
    return null
  })

  handle<UpdateProfilePayload, { id: string; email: string; full_name: string; role: Role }>(
    'auth:updateProfile',
    null,
    async ({ full_name, email }, session) => {
      const data: { full_name?: string; email?: string } = {}
      if (full_name?.trim()) data.full_name = full_name.trim()
      if (email?.trim()) {
        const exists = await prisma.user.findFirst({ where: { email: email.trim(), NOT: { id: session.userId } } })
        if (exists) throw new BadRequestError('Email already in use')
        data.email = email.trim()
      }
      if (Object.keys(data).length === 0) throw new BadRequestError('No fields to update')
      return prisma.user.update({
        where: { id: session.userId },
        data,
        select: { id: true, email: true, full_name: true, role: true }
      })
    }
  )

  handle<void, Array<{ id: string; email: string; full_name: string; role: Role; is_active: boolean; createdAt: Date }>>(
    'auth:listUsers',
    ['ADMIN'],
    async () =>
      prisma.user.findMany({
        select: { id: true, email: true, full_name: true, role: true, is_active: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      })
  )

  handle<CreateUserPayload, { id: string; email: string; full_name: string; role: Role; is_active: boolean }>(
    'auth:createUser',
    ['ADMIN'],
    async ({ email, password, full_name, role }) => {
      if (!email || !password || !full_name || !role) {
        throw new BadRequestError('email, password, full_name and role are required')
      }
      const strengthError = validatePasswordStrength(password)
      if (strengthError) throw new BadRequestError(strengthError)
      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists) throw new BadRequestError('Email already in use')
      const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS)
      return prisma.user.create({
        data: { email, password: hashed, full_name, role },
        select: { id: true, email: true, full_name: true, role: true, is_active: true }
      })
    }
  )

  handle<UpdateUserPayload, { id: string; email: string; full_name: string; role: Role; is_active: boolean }>(
    'auth:updateUser',
    ['ADMIN'],
    async ({ id, full_name, role, is_active, password }) => {
      const user = await prisma.user.findUnique({ where: { id } })
      if (!user) throw new BadRequestError('User not found')
      const data: { full_name?: string; role?: Role; is_active?: boolean; password?: string } = {}
      if (full_name !== undefined) data.full_name = full_name
      if (role !== undefined) data.role = role
      if (is_active !== undefined) data.is_active = is_active
      if (password) {
        const strengthError = validatePasswordStrength(password)
        if (strengthError) throw new BadRequestError(strengthError)
        data.password = await bcrypt.hash(password, BCRYPT_ROUNDS)
      }
      return prisma.user.update({
        where: { id },
        data,
        select: { id: true, email: true, full_name: true, role: true, is_active: true }
      })
    }
  )
}
```

- [ ] **Step 2: Write src/main/ipc/registerAll.ts**

```typescript
import { registerAuthHandlers } from './auth'

export function registerAllHandlers(): void {
  registerAuthHandlers()
}
```

(Each later task adds one more `register*Handlers()` call here.)

- [ ] **Step 3: Wire registerAllHandlers into src/main/index.ts**

Add near the top of the file, after the existing imports:
```typescript
import { registerAllHandlers } from './ipc/registerAll'
```

In the `app.whenReady().then(() => { ... })` block, call `registerAllHandlers()` before `createMainWindow()`:
```typescript
app.whenReady().then(() => {
  registerAllHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})
```

- [ ] **Step 4: Verify it typechecks**

Run: `npm run typecheck:node`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, and from the DevTools console in the running app, run:
```js
await window.api.invokePublic('auth:login', { email: 'admin@optimaclays.rw', password: 'Admin@1234' })
```
Expected: resolves to `{ token: "...", user: { id, email: "admin@optimaclays.rw", full_name: "System Administrator", role: "ADMIN" } }`. Then run `window.api.setToken(<that token>)` and:
```js
await window.api.invoke('auth:profile', {})
```
Expected: resolves to the same user's profile including `pinnedKpis: []`. Stop the dev server after confirming (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/auth.ts src/main/ipc/registerAll.ts src/main/index.ts
git commit -m "feat: port auth and user management to ipc handlers"
```

---

### Task 3: HR domain (Employees, Attendance, Payroll)

**Files:**
- Create: `src/main/ipc/employees.ts`, `src/main/ipc/attendance.ts`, `src/main/ipc/payroll.ts`
- Modify: `src/main/ipc/registerAll.ts` (add the three new register calls)
- Modify: `package.json` (add `exceljs` to dependencies, matching the source backend's version)

Source controllers: `employeeController.ts`, `attendanceController.ts`, `payrollController.ts`. Source routes: `employeeRoutes.ts`, `attendanceRoutes.ts`, `payrollRoutes.ts` (already quoted in full earlier in this planning session — re-read them directly from the source repo, don't rely on secondhand summaries).

**Channel maps:**

Employees (`employeeRoutes.ts`):
| Channel | Source function | Roles |
|---|---|---|
| `employees:list` | `listEmployees` | any authenticated |
| `employees:get` | `getEmployee` | any authenticated |
| `employees:create` | `createEmployee` | ADMIN, ACCOUNTANT |
| `employees:update` | `updateEmployee` | ADMIN, ACCOUNTANT |
| `employees:delete` | `deleteEmployee` | ADMIN |

Attendance (`attendanceRoutes.ts`):
| Channel | Source function | Roles |
|---|---|---|
| `attendance:summary` | `getMonthlySummary` | any authenticated |
| `attendance:list` | `listAttendance` | any authenticated |
| `attendance:create` | `createAttendance` | ADMIN, PRODUCTION_SUPERVISOR, ACCOUNTANT |
| `attendance:update` | `updateAttendance` | ADMIN, PRODUCTION_SUPERVISOR, ACCOUNTANT |

Payroll (`payrollRoutes.ts`):
| Channel | Source function | Roles |
|---|---|---|
| `payroll:list` | `listPayrollRuns` | any authenticated |
| `payroll:create` | `createPayrollRun` | ADMIN, ACCOUNTANT |
| `payroll:get` | `getPayrollRun` | any authenticated |
| `payroll:updateEntry` | `updateEntry` | ADMIN, ACCOUNTANT |
| `payroll:finalize` | `finalizeRun` | ADMIN, ACCOUNTANT |
| `payroll:delete` | `deletePayrollRun` | ADMIN, ACCOUNTANT |
| `payroll:export` | `exportPayroll` | ADMIN, ACCOUNTANT |
| `payroll:payslip` | `downloadPayslipPdf` | ADMIN, ACCOUNTANT |

- [ ] **Step 1: Add exceljs dependency**

Check `backend/package.json` in the source project for the exact `exceljs` version pinned there, and add the same version to this project's `dependencies` in `package.json`. Run `npm install` afterward.

- [ ] **Step 2: Port employeeController.ts to src/main/ipc/employees.ts**

Read `employeeController.ts` in full. Translate each exported function into a `handle()` call following the exact pattern established in Task 2's `auth.ts` (payload interface per handler, `AppError` subclasses for validation failures, Prisma calls unchanged in shape). Route params like `:id` become a field on the payload object (e.g. `{ id: string, ...rest }`) instead of `req.params.id`. Preserve every validation rule and error message from the source controller.

- [ ] **Step 3: Port attendanceController.ts to src/main/ipc/attendance.ts**

Same process as Step 2, using the Attendance channel map above.

- [ ] **Step 4: Port payrollController.ts to src/main/ipc/payroll.ts**

Same process, using the Payroll channel map above, with two specific adjustments:
- `downloadPayslipPdf`: return `{ html: string, filename: string }` (the same HTML template string the source function builds, with `${logoBase64}` reading from `C:\Users\user\OneDrive\Documents\Projects\Desktop\optimaclays_desktop\logo.png` instead of the source project's `backend/assets/logo.png` — read the file with Node's `fs.readFileSync` and base64-encode it the same way the source does). Do not attempt to generate a PDF file or use Puppeteer; that's Phase 6's job.
- `exportPayroll`: build the same xlsx workbook with `exceljs` that the source function builds, but return it as `{ buffer: string (base64), filename: string }` instead of streaming an HTTP response. Writing that buffer to disk via a native save dialog is Phase 4's job.

- [ ] **Step 5: Register the three new handler groups**

Update `src/main/ipc/registerAll.ts`:
```typescript
import { registerAuthHandlers } from './auth'
import { registerEmployeeHandlers } from './employees'
import { registerAttendanceHandlers } from './attendance'
import { registerPayrollHandlers } from './payroll'

export function registerAllHandlers(): void {
  registerAuthHandlers()
  registerEmployeeHandlers()
  registerAttendanceHandlers()
  registerPayrollHandlers()
}
```

- [ ] **Step 6: Verify it typechecks**

Run: `npm run typecheck:node`
Expected: no errors.

- [ ] **Step 7: Manual smoke test**

Run `npm run dev`, log in via the console as in Task 2 Step 5, then verify at least:
```js
await window.api.invoke('employees:list', {})
```
returns `[]` (no employees seeded, per Phase 2's deliberate decision not to hardcode real employee data). Stop the dev server after confirming.

- [ ] **Step 8: Commit**

```bash
git add src/main/ipc/employees.ts src/main/ipc/attendance.ts src/main/ipc/payroll.ts src/main/ipc/registerAll.ts package.json package-lock.json
git commit -m "feat: port hr domain (employees, attendance, payroll) to ipc handlers"
```

---

### Task 4: Production, Inventory, and Suppliers domain

**Files:**
- Create: `src/main/ipc/production.ts`, `src/main/ipc/kilns.ts`, `src/main/ipc/inventory.ts`, `src/main/ipc/suppliers.ts`, `src/main/ipc/reconciliation.ts`
- Modify: `src/main/ipc/registerAll.ts`

Source controllers: `productionController.ts`, `kilnController.ts`, `inventoryController.ts`, `supplierController.ts`, `reconciliationController.ts`.

**Channel maps:**

Production (`productionRoutes.ts`):
| Channel | Source function | Roles |
|---|---|---|
| `production:list` | `listBatches` | any authenticated |
| `production:stats` | `getStats` | any authenticated |
| `production:create` | `createBatch` | any authenticated |
| `production:update` | `updateBatch` | any authenticated |
| `production:complete` | `completeBatch` | any authenticated |
| `production:delete` | `deleteBatch` | ADMIN, PRODUCTION_SUPERVISOR |

`ProductionBatch.defect_types` was a `DefectType[]` in the source schema; use `getDefectTypes`/`setDefectTypes` from `src/main/ipc/repositories/defectTypes.ts` (Task 1) so `production:create`/`production:update`/`production:complete` accept and return a plain `defectTypes: string[]` field, matching what the source controller's request/response shape looked like before the child-table conversion.

Kilns (`kilnRoutes.ts`):
| Channel | Source function | Roles |
|---|---|---|
| `kilns:list` | `listKilns` | any authenticated |
| `kilns:create` | `createKiln` | ADMIN, PRODUCTION_SUPERVISOR |
| `kilns:update` | `updateKiln` | ADMIN, PRODUCTION_SUPERVISOR |
| `kilns:delete` | `deleteKiln` | ADMIN |

Inventory (`inventoryRoutes.ts`):
| Channel | Source function | Roles |
|---|---|---|
| `inventory:listRawMaterials` | `listRawMaterials` | any authenticated |
| `inventory:addRawMaterial` | `addRawMaterial` | any authenticated |
| `inventory:consumeRawMaterial` | `consumeRawMaterial` | any authenticated |
| `inventory:listFinishedGoods` | `listFinishedGoods` | any authenticated |
| `inventory:addFinishedGoods` | `addFinishedGoods` | any authenticated |
| `inventory:setThreshold` | `setThreshold` | any authenticated |

Suppliers (`supplierRoutes.ts`):
| Channel | Source function | Roles |
|---|---|---|
| `suppliers:list` | `listSuppliers` | any authenticated |
| `suppliers:create` | `createSupplier` | ADMIN, STORE_MANAGER |
| `suppliers:update` | `updateSupplier` | ADMIN, STORE_MANAGER |
| `suppliers:delete` | `deleteSupplier` | ADMIN |

`Supplier.material_types` was a `MaterialType[]`; use `getMaterialTypes`/`setMaterialTypes` from Task 1 the same way as above, so `suppliers:create`/`suppliers:update` accept/return `materialTypes: string[]`.

Reconciliation (`reconciliationRoutes.ts`):
| Channel | Source function | Roles |
|---|---|---|
| `reconciliation:list` | `listReconciliations` | any authenticated |
| `reconciliation:get` | `getReconciliation` | any authenticated |
| `reconciliation:create` | `createReconciliation` | ADMIN, STORE_MANAGER |

- [ ] **Step 1: Port productionController.ts to src/main/ipc/production.ts**

Follow the Task 2 pattern. Wire `defectTypes` through the `defectTypes` repository as described above — the source controller currently reads/writes `defect_types` directly on the Prisma model; replace those reads/writes with calls to `getDefectTypes(batchId)` / `setDefectTypes(batchId, defectTypes)` after the main `productionBatch` create/update/complete call.

- [ ] **Step 2: Port kilnController.ts to src/main/ipc/kilns.ts**

Follow the same pattern; no child-table involvement.

- [ ] **Step 3: Port inventoryController.ts to src/main/ipc/inventory.ts**

Follow the same pattern.

- [ ] **Step 4: Port supplierController.ts to src/main/ipc/suppliers.ts**

Follow the same pattern, wiring `materialTypes` through the `materialTypes` repository the same way `defectTypes` is wired in Step 1.

- [ ] **Step 5: Port reconciliationController.ts to src/main/ipc/reconciliation.ts**

Follow the same pattern.

- [ ] **Step 6: Register the five new handler groups**

Add the corresponding imports and `register*Handlers()` calls to `src/main/ipc/registerAll.ts`, same pattern as Task 3 Step 5.

- [ ] **Step 7: Verify it typechecks**

Run: `npm run typecheck:node`
Expected: no errors.

- [ ] **Step 8: Manual smoke test**

Run `npm run dev`, log in, then verify:
```js
await window.api.invoke('kilns:list', {})
```
returns `[]`. Stop the dev server after confirming.

- [ ] **Step 9: Commit**

```bash
git add src/main/ipc/production.ts src/main/ipc/kilns.ts src/main/ipc/inventory.ts src/main/ipc/suppliers.ts src/main/ipc/reconciliation.ts src/main/ipc/registerAll.ts
git commit -m "feat: port production, inventory, and suppliers domains to ipc handlers"
```

---

### Task 5: Sales domain

**Files:**
- Create: `src/main/ipc/customers.ts`, `src/main/ipc/orders.ts`, `src/main/ipc/priceCatalogue.ts`, `src/main/ipc/invoices.ts`, `src/main/ipc/proformas.ts`, `src/main/ipc/payments.ts`, `src/main/ipc/deliveries.ts`
- Modify: `src/main/ipc/registerAll.ts`

Source controllers: `customerController.ts`, `orderController.ts`, `priceCatalogueController.ts`, `invoiceController.ts`, `proformaController.ts`, `paymentController.ts`, `deliveryController.ts`.

**Channel maps:**

Customers (`customerRoutes.ts`): `customers:list` (any), `customers:create` (any), `customers:get` (any), `customers:update` (any), `customers:delete` (any) — mapping to `listCustomers`/`createCustomer`/`getCustomer`/`updateCustomer`/`deleteCustomer`.

Orders (`orderRoutes.ts`): `orders:list` (any) -> `listOrders`, `orders:create` (any) -> `createOrder`, `orders:customerStatement` (any) -> `getCustomerStatement`, `orders:get` (any) -> `getOrder`, `orders:update` (any) -> `updateOrder`, `orders:updateStatus` (any) -> `updateOrderStatus`, `orders:delete` (ADMIN) -> `deleteOrder`.

Price Catalogue (`priceCatalogueRoutes.ts`): `priceCatalogue:list` (any) -> `listPrices`, `priceCatalogue:upsert` (ADMIN) -> `upsertPrice`, `priceCatalogue:delete` (ADMIN) -> `deletePrice`.

Invoices (`invoiceRoutes.ts`): `invoices:list` (any) -> `listInvoices`, `invoices:create` (any) -> `createInvoice`, `invoices:get` (any) -> `getInvoice`, `invoices:delete` (ADMIN, ACCOUNTANT) -> `deleteInvoice`.

Proformas (`proformaRoutes.ts`): `proformas:list` (any) -> `listProformas`, `proformas:create` (any) -> `createProforma`, `proformas:get` (any) -> `getProforma`, `proformas:pdf` (any) -> `downloadProformaPdf`, `proformas:delete` (ADMIN) -> `deleteProforma`.

Payments (`paymentRoutes.ts`): `payments:list` (any) -> `listPayments`, `payments:create` (any) -> `createPayment`.

Deliveries (`deliveryRoutes.ts`): `deliveries:list` (any) -> `listDeliveries`, `deliveries:create` (any) -> `createDelivery`, `deliveries:waybill` (any) -> `downloadWaybillPdf`, `deliveries:updateStatus` (any) -> `updateDeliveryStatus`, `deliveries:recordDamage` (any) -> `recordDamage`, `deliveries:delete` (ADMIN) -> `deleteDelivery`.

- [ ] **Step 1: Port each of the 7 controllers to its corresponding file**

Follow the Task 2 pattern for all 7. For `proformas:pdf` and `deliveries:waybill`: same treatment as `payroll:payslip` in Task 3 — return `{ html: string, filename: string }` built from the source controller's existing HTML-string logic (with the logo read from `logo.png` at the new repo root, same base64-embed approach), no PDF generation, no Puppeteer.

- [ ] **Step 2: Register the seven new handler groups**

Same pattern as before.

- [ ] **Step 3: Verify it typechecks**

Run: `npm run typecheck:node`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`, log in, verify `await window.api.invoke('customers:list', {})` returns `[]`. Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/customers.ts src/main/ipc/orders.ts src/main/ipc/priceCatalogue.ts src/main/ipc/invoices.ts src/main/ipc/proformas.ts src/main/ipc/payments.ts src/main/ipc/deliveries.ts src/main/ipc/registerAll.ts
git commit -m "feat: port sales domain to ipc handlers"
```

---

### Task 6: Finance and System domain

**Files:**
- Create: `src/main/ipc/expenses.ts`, `src/main/ipc/expenseCategories.ts`, `src/main/ipc/reports.ts`, `src/main/ipc/dashboard.ts`, `src/main/ipc/settings.ts`, `src/main/ipc/audit.ts`, `src/main/ipc/notifications.ts`, `src/main/ipc/import.ts`
- Modify: `src/main/ipc/registerAll.ts`
- Modify: `package.json` (add `@fast-csv/format`, matching the source backend's version)

Source controllers: `expenseController.ts`, `expenseCategoryController.ts`, `reportController.ts`, `dashboardController.ts`, `settingsController.ts`, `auditController.ts`, `notificationController.ts`, `importController.ts`.

**Channel maps:**

Expenses (`expenseRoutes.ts`): `expenses:list` (any) -> `listExpenses`, `expenses:create` (any) -> `createExpense`, `expenses:delete` (ADMIN, ACCOUNTANT) -> `deleteExpense`.

Expense categories (`expenseCategoryRoutes.ts`): `expenseCategories:list` (any) -> `listCategories`, `expenseCategories:create` (ADMIN, ACCOUNTANT) -> `createCategory`, `expenseCategories:update` (ADMIN, ACCOUNTANT) -> `updateCategory`, `expenseCategories:delete` (ADMIN) -> `deleteCategory`.

Reports (`reportRoutes.ts`, no role restrictions beyond authentication): `reports:production` -> `productionReport`, `reports:sales` -> `salesReport`, `reports:payroll` -> `payrollReport`, `reports:financials` -> `financialReport`, `reports:exportInvoices` -> `exportInvoicesCSV`, `reports:exportExpenses` -> `exportExpensesCSV`, `reports:exportPayments` -> `exportPaymentsCSV`. The three `export*CSV` handlers: use `@fast-csv/format` the same way the source does, but return `{ buffer: string (base64), filename: string }` instead of streaming an HTTP response, same treatment as `payroll:export` in Task 3.

Dashboard (`dashboardRoutes.ts`): `dashboard:get` (any) -> `getDashboard`.

Settings (`settingsRoutes.ts`): `settings:getCompany` (any) -> `getCompanySettings`, `settings:updateCompany` (ADMIN) -> `updateCompanySettings`, `settings:getPinnedKpis` (any) -> `getPinnedKpis`, `settings:updatePinnedKpis` (any) -> `updatePinnedKpis`. The last two: use `getPinnedKpis`/`setPinnedKpis` from `src/main/ipc/repositories/pinnedKpis.ts` (Task 1) directly. (`auth.ts`'s `auth:profile` handler also calls `getPinnedKpis` to include the current user's pinned KPIs in their own profile response — that's a separate, legitimate read, not the same feature as these two settings endpoints, which manage the full list.)

Audit (`auditRoutes.ts`): `audit:list` (ADMIN) -> `listAuditLogs`.

Notifications (`notificationRoutes.ts`): `notifications:list` (any) -> `getNotifications`, `notifications:markRead` (any) -> `markRead`, `notifications:generate` (any) -> `generateNotifications`.

Import (`importRoutes.ts`): `import:customers` (ADMIN, SALES_OFFICER) -> `importCustomers`, `import:employees` (ADMIN) -> `importEmployees`. These source functions read an uploaded file via multipart form data; since there's no file upload from a browser anymore, change the payload shape to `{ filePath: string }` (a path the renderer obtained from a native `dialog.showOpenDialog` call in Phase 4) and read it directly with `fs.readFileSync(filePath)` instead of `req.file.buffer`.

- [ ] **Step 1: Add @fast-csv/format dependency**

Check `backend/package.json` in the source project for the exact version (the source project depends on `fast-csv`, which bundles `@fast-csv/format`; use whichever of the two the source controller actually imports from — read `reportController.ts`'s import line to confirm) and add it to this project's `dependencies`. Run `npm install`.

- [ ] **Step 2: Port each of the 8 controllers to its corresponding file**

Follow the Task 2 pattern for all 8, applying the payload-shape and buffer-return adjustments noted in the channel map above where relevant.

- [ ] **Step 3: Register the eight new handler groups**

Same pattern as before. `registerAll.ts` should now call all 23 domain register functions.

- [ ] **Step 4: Verify it typechecks**

Run: `npm run typecheck:node`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run `npm run dev`, log in, verify `await window.api.invoke('dashboard:get', {})` resolves without throwing. Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/expenses.ts src/main/ipc/expenseCategories.ts src/main/ipc/reports.ts src/main/ipc/dashboard.ts src/main/ipc/settings.ts src/main/ipc/audit.ts src/main/ipc/notifications.ts src/main/ipc/import.ts src/main/ipc/registerAll.ts package.json package-lock.json
git commit -m "feat: port finance and system domain to ipc handlers"
```

---

### Task 7: README update and PR

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README.md's Status section**

```markdown
## Status

Phase 3 of 6: IPC backend. All 23 resource domains ported from the source
web app's Express controllers to IPC handlers with session-based auth.
Verified via manual smoke tests through the DevTools console. No renderer
UI wiring yet — the app still shows the Phase 1 placeholder screen.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update readme for ipc backend phase"
```

- [ ] **Step 3: Push, open, and merge the PR**

```bash
git push -u origin feature/ipc-backend
gh pr create --title "IPC backend" --body "$(cat <<'EOF'
Phase 3 of the desktop migration (see docs/superpowers/specs/2026-07-23-electron-desktop-migration-design.md).

Ports all 23 resource domains from the source web app's Express controllers
to IPC handlers:
- Shared session/error/handle infrastructure (src/main/ipc/handle.ts,
  session.ts, errors.ts) replacing JWT cookies with an in-memory session
  token, matching the design spec's auth model exactly.
- Role gates ported 1:1 from the source project's authorize(...) middleware
  per route.
- The three Phase 2 child tables (pinned kpis, supplier material types,
  production batch defect types) get repository helpers so handler code
  works with plain string[], matching the old Postgres array-column shape.

Deferred by design (per the spec's phasing, not an oversight):
- PDF-generating actions (payslip, proforma, waybill) return assembled HTML
  + filename, not PDF bytes. Puppeteer is never introduced. Turning that
  HTML into a real PDF via Electron's native printToPDF is Phase 6.
- CSV/XLSX export actions return a base64 buffer + filename. Wiring that to
  an actual native save dialog is Phase 4.
- Bulk import now takes a file path instead of a multipart upload, since
  the source of that path (a native open-file dialog) is also Phase 4.

Verified via manual smoke tests through the running app's DevTools console
at each task boundary (login, then one representative call per new domain
group). No automated test suite for this phase — the real end-to-end proof
comes in Phase 4 when the renderer actually calls these channels through
real UI interactions.
EOF
)"
gh pr merge --merge
git checkout main
git pull origin main
git branch -d feature/ipc-backend
git push origin --delete feature/ipc-backend
```

---

## Self-review notes

- All 23 controllers from the source project (auth+users, employees, attendance, payroll, production, kilns, inventory, suppliers, reconciliation, customers, orders, priceCatalogue, invoices, proformas, payments, deliveries, expenses, expenseCategories, reports, dashboard, settings, audit, notifications, import) have a task and channel mapping above — none were dropped.
- Role gates in every channel map were copied directly from the route files read during planning, not inferred or guessed.
- The three child-table repositories (Task 1) are each consumed by exactly the domain that owns them: `pinnedKpis` by `settings.ts` (Task 6, matching the source's `/api/v1/settings/kpis` endpoints, not auth), `materialTypes` by `suppliers.ts` (Task 4), `defectTypes` by `production.ts` (Task 4).
- No automated tests are added in this phase. That's a deliberate scope call, not an oversight: without a renderer, "real" tests would mean writing IPC-invocation test harnesses that duplicate what Phase 4's actual UI usage will exercise for free. Each task's manual smoke-test step is the interim verification; Phase 4 is where automated coverage becomes worth the investment (real user flows through the actual UI).
