# SQLite Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the existing Optima Clays PostgreSQL/Prisma schema (28 models) to SQLite, seed the admin account, and prove the schema works standalone with real queries, before any Electron/IPC wiring touches it. Phase 2 of 6 from the [migration design spec](../specs/2026-07-23-electron-desktop-migration-design.md).

**Architecture:** Same 28 models as the source project, provider switched to `sqlite`, using `prisma@6.19.3` with the standard `prisma-client-js` generator (verified directly against the source project's data: generates to `node_modules/@prisma/client`, `.env`/`DATABASE_URL` loading works with no extra config). All 16 enums stay as native Prisma `enum` blocks (SQLite has supported enums as TEXT columns since Prisma 6.2.0). The three array fields (`User.pinned_kpis`, `Supplier.material_types`, `ProductionBatch.defect_types`) become child tables with `onDelete: Cascade`, since they're pure per-parent tag lists, not independently meaningful rows.

**Tech Stack:** Prisma 6.19.3, @prisma/client 6.19.3, bcryptjs 3.0.3, tsx 4.23.1 (for running seed/test scripts outside the Electron/Vite build)

**Correction from the first implementation pass:** this plan originally specified `bcrypt` (a native addon). Task 1 hit a real environment gap: this build machine has no Visual Studio C++ Build Tools, so `electron-builder install-app-deps` cannot rebuild `bcrypt` for Electron's Node ABI. Rather than requiring a multi-gigabyte system toolchain install, this plan now uses `bcryptjs` — a pure-JavaScript, API-compatible bcrypt implementation with no native compilation step, ever. For a single-user desktop app doing occasional password hashing (login, password change), the performance difference versus native bcrypt is irrelevant, and this removes a whole class of native-module ABI fragility that would otherwise resurface on every machine that builds this app. All `bcrypt` references below are `bcryptjs`.

---

## File structure

```
optimaclays_desktop/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   ├── verify.test.ts
│   └── migrations/
│       └── <timestamp>_init/migration.sql
├── .env.example
└── tsconfig.node.json          # include list extended to cover prisma/**/*.ts
```

---

### Task 1: Dependencies and schema

**Files:**
- Modify: `package.json`
- Create: `prisma/schema.prisma`
- Create: `.env.example`
- Modify: `tsconfig.node.json`

- [ ] **Step 1: Create the feature branch**

Run: `git checkout -b feature/sqlite-schema main`
Expected: `Switched to a new branch 'feature/sqlite-schema'`

- [ ] **Step 2: Add dependencies to package.json**

Add to `dependencies`:
```json
    "@prisma/client": "^6.19.3",
    "bcryptjs": "^3.0.3"
```

Add to `devDependencies`:
```json
    "prisma": "^6.19.3",
    "tsx": "^4.23.1"
```

Add to `scripts` (after `"postinstall"`):
```json
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "test:db": "tsx --test prisma/verify.test.ts",
```

The full `dependencies`/`devDependencies`/`scripts` blocks after this edit should read:

```json
  "scripts": {
    "dev": "electron-vite dev",
    "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
    "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "build": "npm run typecheck && electron-vite build",
    "build:win": "npm run build && electron-builder --win",
    "postinstall": "electron-builder install-app-deps",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "test:db": "tsx --test prisma/verify.test.ts",
    "pretest:e2e": "npm run build",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@prisma/client": "^6.19.3",
    "bcryptjs": "^3.0.3"
  },
  "devDependencies": {
    "@playwright/test": "^1.61.1",
    "@types/node": "^26.1.1",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.0",
    "electron": "^43.2.0",
    "electron-builder": "^26.15.3",
    "electron-vite": "^5.0.0",
    "prisma": "^6.19.3",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "tsx": "^4.23.1",
    "typescript": "^5.9.3",
    "vite": "^7.3.6"
  }
```

- [ ] **Step 3: Write prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  PRODUCTION_SUPERVISOR
  SALES_OFFICER
  STORE_MANAGER
  ACCOUNTANT
}

enum WageType {
  MONTHLY
  DAILY
  PIECE_RATE
}

enum PaymentStatus {
  PENDING
  PAID
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  HALF_DAY
  LEAVE
}

enum Shift {
  MORNING
  AFTERNOON
  NIGHT
}

enum ProductionStage {
  RAW_MIXING
  MOLDING
  DRYING
  KILN_FIRING
  QUALITY_CHECK
  STOCKPILED
}

enum MaterialType {
  CLAY
  SAND
  FUEL_FIREWOOD
  FUEL_COAL
  DIESEL
  CEMENT
  OTHER
}

enum BrickType {
  BRICK_10
  PAVING_BLOCK
  HALF_BRICK
  LOW_ROCK_BOND
  CUSTOM
}

enum QualityGrade {
  GRADE_A
  GRADE_B
  REJECT
}

enum CustomerType {
  INDIVIDUAL
  COMPANY
}

enum OrderStatus {
  PENDING
  CONFIRMED
  IN_PRODUCTION
  READY
  DELIVERED
  CANCELLED
}

enum PaymentMethod {
  CASH
  MOBILE_MONEY
  BANK_TRANSFER
}

enum DeliveryStatus {
  SCHEDULED
  IN_TRANSIT
  DELIVERED
  RETURNED
}

enum KilnStatus {
  ACTIVE
  MAINTENANCE
  INACTIVE
}

enum DefectType {
  CRACKING
  UNDER_FIRING
  OVER_FIRING
  DIMENSION_ERROR
  COLOUR_VARIATION
  OTHER
}

enum RejectDisposition {
  REWORK
  DOWNGRADE_TO_B
  DISPOSE
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  password     String
  full_name    String
  role         Role     @default(SALES_OFFICER)
  is_active    Boolean  @default(true)
  refreshToken String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  pinnedKpis UserPinnedKpi[]
}

model UserPinnedKpi {
  id     String @id @default(uuid())
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String
  kpi    String

  @@unique([userId, kpi])
}

model Employee {
  id                  String    @id @default(uuid())
  full_name           String
  national_id         String?   @unique
  phone               String?
  job_title           String?
  hire_date           DateTime?
  wage_type           WageType  @default(MONTHLY)
  base_salary         Float     @default(0)
  bank_name           String?
  bank_account_number String?
  is_active           Boolean   @default(true)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  deletedAt           DateTime?

  payrollEntries PayrollEntry[]
  attendanceLogs AttendanceLog[]
}

model PayrollRun {
  id        String        @id @default(uuid())
  month     Int
  year      Int
  status    PaymentStatus @default(PENDING)
  finalized Boolean       @default(false)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  entries PayrollEntry[]
}

model PayrollEntry {
  id             String        @id @default(uuid())
  payrollRun     PayrollRun    @relation(fields: [payrollRunId], references: [id])
  payrollRunId   String
  employee       Employee      @relation(fields: [employeeId], references: [id])
  employeeId     String
  gross_salary   Float
  bonus          Float         @default(0)
  deduction      Float         @default(0)
  net_salary     Float
  narration      String
  payment_status PaymentStatus @default(PENDING)
  payment_date   DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

model AttendanceLog {
  id          String           @id @default(uuid())
  employee    Employee         @relation(fields: [employeeId], references: [id])
  employeeId  String
  date        DateTime
  status      AttendanceStatus
  wage_earned Float?
  notes       String?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@unique([employeeId, date])
}

model Kiln {
  id                String     @id @default(uuid())
  name              String     @unique
  capacity          Int        @default(0)
  status            KilnStatus @default(ACTIVE)
  last_service_date DateTime?
  notes             String?
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  batches ProductionBatch[]
}

model ProductionBatch {
  id                 String             @id @default(uuid())
  date               DateTime
  shift              Shift
  kiln_number        String
  kilnId             String?
  kiln               Kiln?              @relation(fields: [kilnId], references: [id])
  brick_type         BrickType          @default(BRICK_10)
  custom_name        String?
  bricks_target      Int
  bricks_produced    Int                @default(0)
  bricks_rejected    Int                @default(0)
  rejection_reason   String?
  reject_disposition RejectDisposition?
  current_stage      ProductionStage    @default(RAW_MIXING)
  completed_at       DateTime?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  deletedAt          DateTime?

  defectTypes  ProductionBatchDefectType[]
  consumptions RawMaterialConsumption[]
}

model ProductionBatchDefectType {
  id                String          @id @default(uuid())
  productionBatch   ProductionBatch @relation(fields: [productionBatchId], references: [id], onDelete: Cascade)
  productionBatchId String
  defectType        DefectType

  @@unique([productionBatchId, defectType])
}

model Supplier {
  id            String    @id @default(uuid())
  name          String
  contact_name  String?
  phone         String?
  payment_terms String?
  notes         String?
  is_active     Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  materialTypes    SupplierMaterialType[]
  rawMaterialStock RawMaterialStock[]
}

model SupplierMaterialType {
  id           String       @id @default(uuid())
  supplier     Supplier     @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  supplierId   String
  materialType MaterialType

  @@unique([supplierId, materialType])
}

model RawMaterialStock {
  id            String       @id @default(uuid())
  material_type MaterialType
  quantity      Float
  unit          String
  unit_cost     Float
  total_cost    Float
  supplierId    String?
  supplier      Supplier?    @relation(fields: [supplierId], references: [id])
  date          DateTime
  notes         String?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model RawMaterialConsumption {
  id                String           @id @default(uuid())
  material_type     MaterialType
  quantity_used     Float
  date              DateTime
  notes             String?
  productionBatchId String?
  productionBatch   ProductionBatch? @relation(fields: [productionBatchId], references: [id])
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
}

model StockThreshold {
  id            String       @id @default(uuid())
  material_type MaterialType @unique
  threshold     Float
  unit          String
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model FinishedGoodsStock {
  id            String       @id @default(uuid())
  brick_type    BrickType
  custom_name   String?
  quality_grade QualityGrade
  quantity      Int
  source        String       @default("PRODUCTION")
  notes         String?
  date          DateTime     @default(now())
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model StockReconciliation {
  id            String   @id @default(uuid())
  date          DateTime @default(now())
  reconciled_by String
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  items StockReconciliationItem[]
}

model StockReconciliationItem {
  id                String              @id @default(uuid())
  reconciliation    StockReconciliation @relation(fields: [reconciliationId], references: [id])
  reconciliationId  String
  item_type         String
  material_type     String?
  brick_type        String?
  quality_grade     String?
  system_quantity   Float
  physical_quantity Float
  variance          Float
  notes             String?
  createdAt         DateTime            @default(now())
}

model PriceCatalogue {
  id         String    @id @default(uuid())
  brick_type BrickType @unique
  unit_price Float     @default(0)
  is_active  Boolean   @default(true)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}

model Customer {
  id                   String       @id @default(uuid())
  customer_type        CustomerType
  full_name            String?
  phone                String?
  company_name         String?
  tin_number           String?
  contact_person_name  String?
  contact_person_phone String?
  location             String?
  notes                String?
  credit_limit         Float        @default(0)
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt
  deletedAt            DateTime?

  orders           Order[]
  proformaInvoices ProformaInvoice[]
}

model Order {
  id                     String       @id @default(uuid())
  customer               Customer     @relation(fields: [customerId], references: [id])
  customerId             String
  brick_type             BrickType
  custom_name            String?
  quality_grade          QualityGrade
  quantity               Int
  unit_price             Float
  total_amount           Float
  order_date             DateTime     @default(now())
  required_delivery_date DateTime?
  status                 OrderStatus  @default(PENDING)
  notes                  String?
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt
  deletedAt              DateTime?

  proformaInvoices ProformaInvoice[]
  invoices         Invoice[]
  deliveries       Delivery[]
}

model CompanySettings {
  id                      String   @id @default("singleton")
  tin                     String   @default("")
  bank_name               String   @default("")
  bank_account            String   @default("")
  phone                   String   @default("")
  email                   String   @default("")
  address                 String   @default("")
  director_name           String   @default("")
  director_title          String   @default("")
  default_payment_terms   String   @default("")
  default_delivery_period String   @default("")
  overdue_grace_days      Int      @default(0)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}

model ProformaInvoice {
  id              String   @id @default(uuid())
  number          String   @unique
  customer        Customer @relation(fields: [customerId], references: [id])
  customerId      String
  order           Order?   @relation(fields: [orderId], references: [id])
  orderId         String?
  brick_type      String?
  custom_name     String?
  quantity        Int?
  unit_price      Float?
  date_issued     DateTime @default(now())
  valid_until     DateTime
  subtotal        Float
  total           Float
  notes           String?
  payment_terms   String?
  delivery_period String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Invoice {
  id         String    @id @default(uuid())
  number     String    @unique
  order      Order     @relation(fields: [orderId], references: [id])
  orderId    String
  date       DateTime  @default(now())
  due_date   DateTime?
  subtotal   Float
  total      Float
  is_overdue Boolean   @default(false)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  items    InvoiceItem[]
  payments Payment[]
}

model InvoiceItem {
  id            String       @id @default(uuid())
  invoice       Invoice      @relation(fields: [invoiceId], references: [id])
  invoiceId     String
  description   String
  brick_type    BrickType
  quality_grade QualityGrade
  quantity      Int
  unit_price    Float
  total         Float
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model Payment {
  id        String        @id @default(uuid())
  invoice   Invoice       @relation(fields: [invoiceId], references: [id])
  invoiceId String
  amount    Float
  date      DateTime      @default(now())
  method    PaymentMethod
  reference String?
  notes     String?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
}

model Delivery {
  id                   String         @id @default(uuid())
  order                Order          @relation(fields: [orderId], references: [id])
  orderId              String
  vehicle_plate        String?
  driver_name          String?
  scheduled_date       DateTime?
  actual_delivery_date DateTime?
  quantity_loaded      Int            @default(0)
  status               DeliveryStatus @default(SCHEDULED)
  receiver_name        String?
  damage_qty           Int            @default(0)
  damage_notes         String?
  notes                String?
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt

  costs DeliveryCost[]
}

model DeliveryCost {
  id               String   @id @default(uuid())
  delivery         Delivery @relation(fields: [deliveryId], references: [id])
  deliveryId       String
  fuel_cost        Float    @default(0)
  driver_fee       Float    @default(0)
  hired_truck_cost Float    @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model ExpenseCategoryConfig {
  id         String   @id @default(uuid())
  name       String   @unique
  is_active  Boolean  @default(true)
  sort_order Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Expense {
  id          String   @id @default(uuid())
  category    String   @default("OTHER")
  amount      Float
  date        DateTime
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AuditLog {
  id          String   @id @default(uuid())
  user_id     String?
  user_name   String?
  action      String
  resource    String
  resource_id String?
  old_values  Json?
  new_values  Json?
  ip_address  String?
  createdAt   DateTime @default(now())
}

model Notification {
  id          String   @id @default(uuid())
  user_id     String?
  type        String
  title       String
  message     String
  is_read     Boolean  @default(false)
  resource    String?
  resource_id String?
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 4: Write .env.example**

```env
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 5: Create the actual .env for local development (not committed)**

```bash
cp .env.example .env
```

(`.env` is already in `.gitignore` from Phase 1 — verify with `git check-ignore .env` before continuing; it should print `.env` with no error.)

- [ ] **Step 6: Extend tsconfig.node.json to typecheck the prisma/ scripts**

In `tsconfig.node.json`, change the `include` array from:
```json
  "include": ["electron.vite.config.ts", "src/main/**/*", "src/preload/**/*"]
```
to:
```json
  "include": ["electron.vite.config.ts", "src/main/**/*", "src/preload/**/*", "prisma/**/*.ts"]
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: completes with no errors. `node_modules/.bin/prisma` and `node_modules/.bin/tsx` exist. `postinstall` runs `electron-builder install-app-deps` again — this should complete cleanly now, since `bcryptjs` has no native module to rebuild (unlike Prisma's own query engine, which is a downloaded binary, not a compiled-from-source native addon, so it isn't affected by the missing C++ build toolchain either).

- [ ] **Step 8: Generate the Prisma client**

Run: `npm run db:generate`
Expected: `✔ Generated Prisma Client (v6.19.3) to .\node_modules\@prisma\client`

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma .env.example tsconfig.node.json
git commit -m "feat: add sqlite prisma schema with enum and child-table conversions"
```

Note: do not `git add .env` — it must stay untracked/gitignored.

---

### Task 2: Initial migration

**Files:**
- Create: `prisma/migrations/<timestamp>_init/migration.sql` (generated, not hand-written)

- [ ] **Step 1: Run the initial migration**

Run: `npm run db:migrate -- --name init`
Expected: creates `prisma/dev.db`, generates and applies `prisma/migrations/<timestamp>_init/migration.sql`, prints "Your database is now in sync with your schema," then regenerates the client.

- [ ] **Step 2: Sanity-check the generated SQL**

Run: `cat prisma/migrations/*/migration.sql | grep -c "CREATE TABLE"`
Expected: `31` (28 original models + 3 new child tables: `UserPinnedKpi`, `SupplierMaterialType`, `ProductionBatchDefectType`).

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations
git commit -m "feat: add initial sqlite migration"
```

Note: `prisma/dev.db` must NOT be committed — it's covered by the existing `*.db` gitignore rule from Phase 1. Verify with `git status --porcelain` showing no `dev.db` before committing.

---

### Task 3: Seed script

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write prisma/seed.ts**

```typescript
import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const hashedPassword = await bcrypt.hash('Admin@1234', 12)

  await prisma.user.upsert({
    where: { email: 'admin@optimaclays.rw' },
    update: { password: hashedPassword },
    create: {
      email: 'admin@optimaclays.rw',
      password: hashedPassword,
      full_name: 'System Administrator',
      role: Role.ADMIN
    }
  })

  console.log('Seed completed: admin user ready')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

This seeds only the admin account. The source web project's seed script also inserts 13 real employees with their real bank account numbers — that data is personal and financial information about actual people, and shouldn't be baked into a script committed to a git repository. If real employee records are wanted in the desktop app later, they should be entered through the app's own UI once it exists, not hardcoded here.

- [ ] **Step 2: Run the seed**

Run: `npm run db:seed`
Expected: prints `Seed completed: admin user ready`, exit code 0.

- [ ] **Step 3: Verify typecheck still passes**

Run: `npm run typecheck:node`
Expected: no errors (covers `prisma/seed.ts` now that Task 1 Step 6 added `prisma/**/*.ts` to the include list).

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed admin user"
```

---

### Task 4: Standalone verification tests

**Files:**
- Create: `prisma/verify.test.ts`

- [ ] **Step 1: Write prisma/verify.test.ts**

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test('seeded admin user exists with the correct role and a valid password hash', async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@optimaclays.rw' } })
  assert.ok(admin, 'admin user should exist after seeding')
  assert.equal(admin?.role, 'ADMIN')
  const passwordMatches = await bcrypt.compare('Admin@1234', admin!.password)
  assert.ok(passwordMatches, 'seeded password hash should verify against Admin@1234')
})

test('pinned kpis child table stores and returns a list for a user', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'kpi-test@optimaclays.rw',
      password: 'not-a-real-hash',
      full_name: 'KPI Test User',
      role: 'ACCOUNTANT',
      pinnedKpis: { create: [{ kpi: 'revenue' }, { kpi: 'production' }] }
    },
    include: { pinnedKpis: true }
  })
  assert.equal(user.pinnedKpis.length, 2)
  assert.deepEqual(user.pinnedKpis.map((k) => k.kpi).sort(), ['production', 'revenue'])
  await prisma.user.delete({ where: { id: user.id } })
})

test('supplier material types child table stores and returns a list', async () => {
  const supplier = await prisma.supplier.create({
    data: {
      name: 'Test Supplier',
      materialTypes: { create: [{ materialType: 'CLAY' }, { materialType: 'SAND' }] }
    },
    include: { materialTypes: true }
  })
  assert.equal(supplier.materialTypes.length, 2)
  await prisma.supplier.delete({ where: { id: supplier.id } })
})

test('production batch defect types child table stores and returns a list', async () => {
  const kiln = await prisma.kiln.create({ data: { name: `Test Kiln ${Date.now()}` } })
  const batch = await prisma.productionBatch.create({
    data: {
      date: new Date(),
      shift: 'MORNING',
      kiln_number: '1',
      kilnId: kiln.id,
      bricks_target: 1000,
      defectTypes: { create: [{ defectType: 'CRACKING' }, { defectType: 'OVER_FIRING' }] }
    },
    include: { defectTypes: true }
  })
  assert.equal(batch.defectTypes.length, 2)
  await prisma.productionBatch.delete({ where: { id: batch.id } })
  await prisma.kiln.delete({ where: { id: kiln.id } })
})

test('deleting a user cascades to its pinned kpis', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'cascade-test@optimaclays.rw',
      password: 'not-a-real-hash',
      full_name: 'Cascade Test User',
      role: 'SALES_OFFICER',
      pinnedKpis: { create: [{ kpi: 'orders' }] }
    }
  })
  await prisma.user.delete({ where: { id: user.id } })
  const orphaned = await prisma.userPinnedKpi.findMany({ where: { userId: user.id } })
  assert.equal(orphaned.length, 0, 'pinned kpi rows should be cascade-deleted with their user')
})

test.after(async () => {
  await prisma.$disconnect()
})
```

- [ ] **Step 2: Run the verification tests**

Run: `npm run test:db`
Expected: `# pass 5` (5 tests, all passing), `# fail 0`.

- [ ] **Step 3: Commit**

```bash
git add prisma/verify.test.ts
git commit -m "test: verify seed data and child-table schema conversions"
```

---

### Task 5: README update and PR

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README.md**

Replace the "Status" section:
```markdown
## Status

Phase 2 of 6: SQLite schema. Prisma schema, migrations, and admin seed exist
and are verified standalone. No IPC/UI wiring to the app yet.
```

Add a new section after "## Testing":
```markdown

## Database

    cp .env.example .env   # first time only
    npm run db:migrate     # apply schema to prisma/dev.db
    npm run db:seed        # create the admin account
    npm run test:db        # verify schema + seed with real queries
    npm run db:studio      # browse the database

Default admin login: `admin@optimaclays.rw` / `Admin@1234`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update readme for sqlite schema phase"
```

- [ ] **Step 3: Push, open, and merge the PR**

```bash
git push -u origin feature/sqlite-schema
gh pr create --title "SQLite schema and admin seed" --body "$(cat <<'EOF'
Phase 2 of the desktop migration (see docs/superpowers/specs/2026-07-23-electron-desktop-migration-design.md).

Ports the 28-model Prisma schema from the source web project to SQLite:
- All 16 enums kept as native Prisma enums (SQLite has supported this since
  Prisma 6.2.0), rather than downgrading to plain strings.
- The three array fields (User.pinned_kpis, Supplier.material_types,
  ProductionBatch.defect_types) become child tables with cascade delete.
- Admin account seeded (admin@optimaclays.rw / Admin@1234) via upsert.
- Uses bcryptjs instead of native bcrypt (see plan doc for why: no C++
  build toolchain on this machine, and no reason to accept that fragility
  for a low-throughput desktop app anyway).

No Electron/IPC wiring yet, that's Phase 3. This phase is verified entirely
standalone: migration applies cleanly, seed runs, and 5 real-query tests
(npm run test:db) cover the seeded admin, all three child-table conversions,
and cascade-delete behavior.

Note: the source project's seed script also hardcodes 13 real employees with
real bank account numbers. That's personal/financial data about actual people
and doesn't belong in a seed script in a git repo, so it's deliberately left
out here. Real employee records should go in through the app's own UI once
it exists.
EOF
)"
gh pr merge --merge
git checkout main
git pull origin main
```

---

## Self-review notes

- Every model from the source schema (28) is present with exactly two categories of change: enum blocks kept as-is, three array fields replaced by child tables. Relations, unique constraints, and defaults are otherwise unchanged from the source `schema.prisma`.
- `UserPinnedKpi`/`SupplierMaterialType`/`ProductionBatchDefectType` field names (`kpi`, `materialType`, `defectType`) and relation names (`pinnedKpis`, `materialTypes`, `defectTypes`) are used consistently between the schema (Task 1) and the verification tests (Task 4).
- The repository-helper layer mentioned in the design spec ("callers still work with `string[]` in and out") is deliberately not built in this phase — there are no callers yet. Building it now would be premature abstraction; it belongs in Phase 3 where the IPC handlers that actually need it get written.
- Real employee PII from the source project's seed script is explicitly excluded, with the reasoning documented in both this plan and the PR body.
