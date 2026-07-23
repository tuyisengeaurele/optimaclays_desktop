import fs from 'fs'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

interface ImportPayload {
  filePath: string
}

interface ImportResult {
  imported: number
  errors: string[]
}

// Ports importController.ts's hand-rolled CSV parser verbatim (the source has no CSV
// library dependency for this - it just splits on commas and strips surrounding quotes).
function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] || ''
    })
    return row
  })
}

function readCsvFile(filePath: string): string {
  if (!filePath) throw new BadRequestError('filePath is required')
  if (!fs.existsSync(filePath)) throw new NotFoundError('File not found')
  return fs.readFileSync(filePath, 'utf-8')
}

// The source used Prisma's createMany({ skipDuplicates: true }) to silently drop rows that
// collide with a unique constraint (e.g. a repeated national_id). SQLite doesn't support
// skipDuplicates on createMany, so duplicates are skipped one row at a time instead,
// preserving the same "silently skip, keep going" behavior and final imported count.
async function createSkippingDuplicates<T>(items: T[], create: (item: T) => Promise<unknown>): Promise<number> {
  let imported = 0
  for (const item of items) {
    try {
      await create(item)
      imported++
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue
      throw error
    }
  }
  return imported
}

export function registerImportHandlers(): void {
  handle<ImportPayload, ImportResult>('import:customers', ['ADMIN', 'SALES_OFFICER'], async ({ filePath }) => {
    const csv = readCsvFile(filePath)
    const rows = parseCSV(csv)
    if (rows.length === 0) throw new BadRequestError('No valid rows found in CSV')

    const errors: string[] = []
    const toCreate: Prisma.CustomerCreateManyInput[] = []

    rows.forEach((row, i) => {
      const rowNum = i + 2
      if (!row.customer_type) {
        errors.push(`Row ${rowNum}: customer_type is required`)
        return
      }
      if (row.customer_type === 'INDIVIDUAL' && !row.full_name && !row.company_name) {
        errors.push(`Row ${rowNum}: full_name is required for individual`)
        return
      }
      if (row.customer_type === 'COMPANY' && !row.company_name) {
        errors.push(`Row ${rowNum}: company_name is required for company`)
        return
      }
      toCreate.push({
        customer_type: row.customer_type as Prisma.CustomerCreateManyInput['customer_type'],
        full_name: row.full_name || null,
        company_name: row.company_name || null,
        tin_number: row.tin_number || null,
        phone: row.phone || null,
        location: row.location || null,
        notes: row.notes || null,
        credit_limit: row.credit_limit ? Number(row.credit_limit) : 0
      })
    })

    if (errors.length > 0 && toCreate.length === 0) throw new BadRequestError(errors.join('; '))

    const imported = await createSkippingDuplicates(toCreate, (data) => prisma.customer.create({ data }))
    return { imported, errors }
  })

  handle<ImportPayload, ImportResult>('import:employees', ['ADMIN'], async ({ filePath }) => {
    const csv = readCsvFile(filePath)
    const rows = parseCSV(csv)
    if (rows.length === 0) throw new BadRequestError('No valid rows found in CSV')

    const errors: string[] = []
    const toCreate: Prisma.EmployeeCreateManyInput[] = []

    rows.forEach((row, i) => {
      const rowNum = i + 2
      if (!row.full_name) {
        errors.push(`Row ${rowNum}: full_name is required`)
        return
      }
      const wage_type = row.wage_type || 'MONTHLY'
      if (!['MONTHLY', 'DAILY', 'PIECE_RATE'].includes(wage_type)) {
        errors.push(`Row ${rowNum}: wage_type must be MONTHLY, DAILY, or PIECE_RATE`)
        return
      }
      toCreate.push({
        full_name: row.full_name,
        national_id: row.national_id || null,
        phone: row.phone || null,
        job_title: row.job_title || null,
        wage_type: wage_type as Prisma.EmployeeCreateManyInput['wage_type'],
        base_salary: row.base_salary ? Number(row.base_salary) : 0,
        bank_name: row.bank_name || null,
        bank_account_number: row.bank_account_number || null
      })
    })

    if (errors.length > 0 && toCreate.length === 0) throw new BadRequestError(errors.join('; '))

    const imported = await createSkippingDuplicates(toCreate, (data) => prisma.employee.create({ data }))
    return { imported, errors }
  })
}
