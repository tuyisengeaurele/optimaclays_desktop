import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { prisma } from './db'
import { splitSqlStatements } from './sqlStatements'

const MIGRATIONS_DIR = app.isPackaged
  ? join(process.resourcesPath, 'migrations')
  : join(__dirname, '../../prisma/migrations')

// The packaged app has no prisma CLI available to run against a fresh
// userData database, so migrations apply themselves here instead: each
// migration folder's SQL runs once, tracked in a small local table so
// re-launching never re-applies one.
async function applyMigrations(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "_app_migrations" ("name" TEXT NOT NULL PRIMARY KEY, "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)'
  )

  const applied = await prisma.$queryRawUnsafe<Array<{ name: string }>>('SELECT name FROM "_app_migrations"')
  const appliedNames = new Set(applied.map((row) => row.name))

  const folders = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  for (const folder of folders) {
    if (appliedNames.has(folder)) continue
    const sqlPath = join(MIGRATIONS_DIR, folder, 'migration.sql')
    if (!existsSync(sqlPath)) continue

    const statements = splitSqlStatements(readFileSync(sqlPath, 'utf-8'))
    await prisma.$transaction(async (tx) => {
      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement)
      }
      await tx.$executeRawUnsafe('INSERT INTO "_app_migrations" ("name") VALUES (?)', folder)
    })
  }
}

async function seedAdminIfEmpty(): Promise<void> {
  const userCount = await prisma.user.count()
  if (userCount > 0) return

  const hashedPassword = await bcrypt.hash('Admin@1234', 12)
  await prisma.user.create({
    data: {
      email: 'admin@optimaclays.rw',
      password: hashedPassword,
      full_name: 'System Administrator',
      role: Role.ADMIN
    }
  })
}

export async function initializeDatabase(): Promise<void> {
  await applyMigrations()
  await seedAdminIfEmpty()
}
