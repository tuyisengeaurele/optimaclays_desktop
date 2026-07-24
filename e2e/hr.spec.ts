import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { launchApp } from './helpers'

const prisma = new PrismaClient()

let app: ElectronApplication
let window: Page
let adminToken: string

interface EmployeeDto {
  id: string
  full_name: string
}

interface AttendanceLogDto {
  id: string
  employeeId: string
}

interface PayrollRunDto {
  id: string
  month: number
  year: number
}

test.beforeAll(async () => {
  ;({ app, window } = await launchApp())
  await window.waitForSelector('h1')

  const login = await invokePublic<{ token: string }>('auth:login', {
    email: 'admin@optimaclays.rw',
    password: 'Admin@1234'
  })
  adminToken = login.token
})

test.afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

function invokePublic<T>(channel: string, payload: unknown): Promise<T> {
  return window.evaluate(
    ({ channel, payload }) => (window as unknown as { api: { invokePublic: (c: string, p: unknown) => Promise<unknown> } }).api.invokePublic(channel, payload) as Promise<T>,
    { channel, payload }
  )
}

function invokeWithToken<T>(channel: string, token: string | null, payload: unknown): Promise<T> {
  return window.evaluate(
    ({ channel, token, payload }) => {
      const api = (window as unknown as { api: { invoke: (c: string, p: unknown) => Promise<unknown>; setToken: (t: string | null) => void } }).api
      api.setToken(token)
      return api.invoke(channel, payload) as Promise<unknown>
    },
    { channel, token, payload }
  ) as Promise<T>
}

// Picks a month/year combination with no existing payroll run, so the test
// never collides with real data left over in the dev database.
async function findFreeMonthYear(): Promise<{ month: number; year: number }> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const year = 1900 + Math.floor(Math.random() * 300)
    const month = 1 + Math.floor(Math.random() * 12)
    const existing = await prisma.payrollRun.findFirst({ where: { month, year } })
    if (!existing) return { month, year }
  }
  throw new Error('Could not find a free month/year for the payroll test run')
}

test('employees -> attendance -> payroll round-trip through real IPC, with cleanup', async () => {
  const nationalId = `TEST-${Date.now()}`
  let employeeId: string | null = null
  let payrollRunId: string | null = null

  try {
    // employees:create
    const employee = await invokeWithToken<EmployeeDto>('employees:create', adminToken, {
      full_name: 'HR E2E Test Employee',
      national_id: nationalId,
      wage_type: 'DAILY',
      base_salary: 5000
    })
    employeeId = employee.id
    expect(employee.full_name).toBe('HR E2E Test Employee')

    // employees:list shows it
    const employees = await invokeWithToken<EmployeeDto[]>('employees:list', adminToken, {})
    expect(employees.some((e) => e.id === employeeId)).toBe(true)

    // attendance:create for that employee
    const attendanceDate = '2026-07-01'
    const log = await invokeWithToken<AttendanceLogDto>('attendance:create', adminToken, {
      employeeId,
      date: attendanceDate,
      status: 'PRESENT'
    })
    expect(log.employeeId).toBe(employeeId)

    // attendance:list shows it
    const logs = await invokeWithToken<AttendanceLogDto[]>('attendance:list', adminToken, { employeeId })
    expect(logs.some((l) => l.id === log.id)).toBe(true)

    // payroll:create for a run
    const { month, year } = await findFreeMonthYear()
    const run = await invokeWithToken<PayrollRunDto>('payroll:create', adminToken, { month, year })
    payrollRunId = run.id
    expect(run.month).toBe(month)
    expect(run.year).toBe(year)

    // payroll:list shows it
    const runs = await invokeWithToken<PayrollRunDto[]>('payroll:list', adminToken, {})
    expect(runs.some((r) => r.id === payrollRunId)).toBe(true)

    // payroll:payslip and payroll:export both read the logo via the shared
    // logoPath.ts helper - exercise them for real rather than trusting a
    // byte-diff that the refactor didn't change runtime behavior.
    const payslip = await invokeWithToken<{ html: string; filename: string }>('payroll:payslip', adminToken, {
      runId: payrollRunId,
      employeeId
    })
    expect(payslip.html.length).toBeGreaterThan(0)
    expect(payslip.filename.length).toBeGreaterThan(0)

    const exported = await invokeWithToken<{ buffer: string; filename: string }>('payroll:export', adminToken, {
      runId: payrollRunId
    })
    expect(exported.buffer.length).toBeGreaterThan(0)
    expect(exported.filename.length).toBeGreaterThan(0)
  } finally {
    // Clean up in FK-safe order: payroll entries -> payroll run -> attendance logs -> employee.
    if (payrollRunId) {
      await prisma.payrollEntry.deleteMany({ where: { payrollRunId } })
      await prisma.payrollRun.delete({ where: { id: payrollRunId } }).catch(() => {})
    }
    if (employeeId) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId } })
      await prisma.employee.delete({ where: { id: employeeId } }).catch(() => {})
    }
  }
})

test('employees:delete is rejected for a non-ADMIN role', async () => {
  const nationalId = `TEST-ROLEGATE-${Date.now()}`
  const employee = await invokeWithToken<EmployeeDto>('employees:create', adminToken, {
    full_name: 'HR E2E Role Gate Employee',
    national_id: nationalId,
    wage_type: 'MONTHLY',
    base_salary: 100000
  })

  const hashed = await bcrypt.hash('NotAdmin@1234', 12)
  const nonAdmin = await prisma.user.create({
    data: {
      email: 'hr-non-admin-test@optimaclays.rw',
      password: hashed,
      full_name: 'HR Non Admin Test User',
      role: 'ACCOUNTANT'
    }
  })

  try {
    const { token } = await invokePublic<{ token: string }>('auth:login', {
      email: 'hr-non-admin-test@optimaclays.rw',
      password: 'NotAdmin@1234'
    })
    // ACCOUNTANT can create employees but must not be able to delete them.
    await expect(invokeWithToken('employees:delete', token, { id: employee.id })).rejects.toThrow('Forbidden')
  } finally {
    await prisma.user.delete({ where: { id: nonAdmin.id } })
    await prisma.employee.delete({ where: { id: employee.id } })
  }
})
