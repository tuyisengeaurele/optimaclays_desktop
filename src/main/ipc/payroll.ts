import fs from 'fs'
import ExcelJS from 'exceljs'
import type { PaymentStatus, PayrollRun, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'
import { LOGO_PATH } from './logoPath'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type PayrollRunWithCount = Prisma.PayrollRunGetPayload<{ include: { _count: { select: { entries: true } } } }>
type PayrollRunWithEntries = Prisma.PayrollRunGetPayload<{ include: { entries: { include: { employee: true } } } }>
type PayrollEntryWithEmployee = Prisma.PayrollEntryGetPayload<{ include: { employee: true } }>

interface CreatePayrollRunPayload {
  month: number
  year: number
}

interface GetPayrollRunPayload {
  runId: string
}

interface UpdateEntryPayload {
  runId: string
  entryId: string
  gross_salary?: number
  bonus?: number
  deduction?: number
  payment_status?: PaymentStatus
  payment_date?: string
}

interface FinalizeRunPayload {
  runId: string
}

interface DeletePayrollRunPayload {
  runId: string
}

interface ExportPayrollPayload {
  runId: string
}

interface PayslipPayload {
  runId: string
  employeeId: string
}

export function registerPayrollHandlers(): void {
  handle<void, PayrollRunWithCount[]>('payroll:list', null, async () =>
    prisma.payrollRun.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { _count: { select: { entries: true } } }
    })
  )

  handle<CreatePayrollRunPayload, PayrollRunWithEntries>('payroll:create', ['ADMIN', 'ACCOUNTANT'], async ({ month, year }) => {
    const existing = await prisma.payrollRun.findFirst({ where: { month, year } })
    if (existing) throw new BadRequestError('Payroll run for this month/year already exists')

    const employees = await prisma.employee.findMany({ where: { deletedAt: null, is_active: true } })
    const monStr = MONTHS[month - 1]

    // DAILY/PIECE_RATE staff are paid whatever they actually earned that month, tallied
    // from their attendance records, rather than a flat monthly figure.
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)
    const dailyWages = await prisma.attendanceLog.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { in: employees.filter((e) => e.wage_type !== 'MONTHLY').map((e) => e.id) },
        date: { gte: start, lt: end }
      },
      _sum: { wage_earned: true }
    })
    const wagesByEmployee = new Map(dailyWages.map((w) => [w.employeeId, w._sum.wage_earned || 0]))

    return prisma.payrollRun.create({
      data: {
        month,
        year,
        entries: {
          create: employees.map((e) => {
            const gross = e.wage_type === 'MONTHLY' ? e.base_salary || 0 : wagesByEmployee.get(e.id) || 0
            const narration = e.wage_type === 'MONTHLY' ? `Monthly-salary-${monStr}-${year}` : `Daily-wages-${monStr}-${year}`
            return {
              employeeId: e.id,
              gross_salary: gross,
              net_salary: gross,
              narration
            }
          })
        }
      },
      include: { entries: { include: { employee: true } } }
    })
  })

  handle<GetPayrollRunPayload, PayrollRunWithEntries>('payroll:get', null, async ({ runId }) => {
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { entries: { include: { employee: true } } }
    })
    if (!run) throw new NotFoundError('Payroll run not found')
    return run
  })

  handle<UpdateEntryPayload, PayrollEntryWithEmployee>(
    'payroll:updateEntry',
    ['ADMIN', 'ACCOUNTANT'],
    async ({ runId, entryId, gross_salary, bonus, deduction, payment_status, payment_date }) => {
      const entry = await prisma.payrollEntry.findFirst({ where: { id: entryId, payrollRunId: runId } })
      if (!entry) throw new NotFoundError('Entry not found')

      const resolvedGross = gross_salary ?? entry.gross_salary
      const resolvedBonus = bonus ?? entry.bonus
      const resolvedDeduction = deduction ?? entry.deduction

      return prisma.payrollEntry.update({
        where: { id: entryId },
        data: {
          gross_salary: resolvedGross,
          bonus: resolvedBonus,
          deduction: resolvedDeduction,
          net_salary: resolvedGross + resolvedBonus - resolvedDeduction,
          payment_status: payment_status ?? entry.payment_status,
          payment_date: payment_date ? new Date(payment_date) : entry.payment_date
        },
        include: { employee: true }
      })
    }
  )

  handle<FinalizeRunPayload, PayrollRun>('payroll:finalize', ['ADMIN', 'ACCOUNTANT'], async ({ runId }) => {
    const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
    if (!run) throw new NotFoundError('Payroll run not found')
    if (run.finalized) throw new BadRequestError('Payroll run is already finalized')
    return prisma.payrollRun.update({
      where: { id: runId },
      data: { finalized: true }
    })
  })

  handle<DeletePayrollRunPayload, { deleted: boolean }>('payroll:delete', ['ADMIN', 'ACCOUNTANT'], async ({ runId }) => {
    const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
    if (!run) throw new NotFoundError('Payroll run not found')
    if (run.finalized) throw new BadRequestError('Cannot delete a finalized payroll run')
    // Cascade delete entries first
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: run.id } })
    await prisma.payrollRun.delete({ where: { id: run.id } })
    return { deleted: true }
  })

  handle<ExportPayrollPayload, { buffer: string; filename: string }>(
    'payroll:export',
    ['ADMIN', 'ACCOUNTANT'],
    async ({ runId }) => {
      const run = await prisma.payrollRun.findUnique({
        where: { id: runId },
        include: { entries: { include: { employee: true } } }
      })
      if (!run) throw new NotFoundError('Payroll run not found')

      // The source backend read COMPANY_NAME/MD_NAME/RECONCILIATION_ACCOUNT from
      // process.env, but never actually documented or set them - every other
      // controller (e.g. proformaController) reads this same data from
      // CompanySettings instead, so this export does the same for consistency.
      const settings = await prisma.companySettings.findUnique({ where: { id: 'singleton' } })
      const companyName = 'OPTIMA CLAYS LTD'
      const mdName = settings?.director_name || ''
      const reconciliationAccount = settings?.bank_account || ''

      const monStr = MONTHS[run.month - 1]
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet(`${monStr}-${run.year}`)

      // Row 1: title merged
      ws.mergeCells('A1:H1')
      ws.getCell('A1').value = `MONTHLY SALARIES ${monStr.toUpperCase()} ${run.year} ${companyName}`
      ws.getCell('A1').font = { bold: true, size: 13 }
      ws.getCell('A1').alignment = { horizontal: 'center' }

      // Row 2: headers
      const headers = [
        'RESERVED',
        'BENEFICIARY NAME',
        'BANK NAME',
        'BENEFICIARY ACCOUNT NUMBER',
        'CREDIT AMOUNT (RWF)',
        'NARRATION',
        'RECONCILIATION ACC',
        'RESERVED'
      ]
      ws.getRow(2).values = headers
      ws.getRow(2).font = { bold: true }

      let total = 0
      run.entries.forEach((entry: PayrollEntryWithEmployee, i: number) => {
        const row = i + 3
        ws.getRow(row).values = [
          '',
          entry.employee.full_name,
          entry.employee.bank_name || '',
          entry.employee.bank_account_number || '',
          Math.round(entry.net_salary),
          entry.narration,
          reconciliationAccount,
          ''
        ]
        total += entry.net_salary
      })

      const totalRow = run.entries.length + 3
      ws.getRow(totalRow).values = ['', '', '', 'TOTAL=', Math.round(total), '', '', '']
      ws.getRow(totalRow).font = { bold: true }

      ws.getRow(totalRow + 1).values = [`PREPARED AND APPROVED BY: ${mdName}`]
      ws.getRow(totalRow + 2).values = [`Managing Director of ${companyName}`]

      const arrayBuffer = await wb.xlsx.writeBuffer()
      const buffer = Buffer.from(arrayBuffer).toString('base64')
      return { buffer, filename: `payroll-${monStr}-${run.year}.xlsx` }
    }
  )

  handle<PayslipPayload, { html: string; filename: string }>(
    'payroll:payslip',
    ['ADMIN', 'ACCOUNTANT'],
    async ({ runId, employeeId }) => {
      const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
      if (!run) throw new NotFoundError('Payslip not found')

      const entry = await prisma.payrollEntry.findFirst({
        where: { payrollRunId: runId, employeeId },
        include: { employee: true }
      })
      if (!entry) throw new NotFoundError('Payslip not found')

      const monStr = MONTHS[run.month - 1]
      const fmt = (n: number): string => n.toLocaleString('en-RW')

      // Read logo
      let logoHtml = '<div style="background:#C0392B;color:white;padding:20px;font-size:24px;font-weight:bold;">OPTIMA CLAYS LTD</div>'
      try {
        if (fs.existsSync(LOGO_PATH)) {
          const ext = 'png'
          const b64 = fs.readFileSync(LOGO_PATH).toString('base64')
          logoHtml = `<img src="data:image/${ext};base64,${b64}" style="height:80px;" />`
        }
      } catch {
        // fall back to the text logo above
      }

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Payslip - ${entry.employee.full_name}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #2C3E50; }
  .header { background: #C0392B; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { margin: 0; font-size: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  td, th { border: 1px solid #ddd; padding: 10px; }
  th { background: #F5F0EB; font-weight: bold; }
  .total-row td { font-weight: bold; background: #F5F0EB; }
</style>
</head>
<body>
<div class="header">
  <div>${logoHtml}</div>
  <div>
    <h1>PAYSLIP</h1>
    <div>${monStr} ${run.year}</div>
  </div>
</div>
<table style="margin-top:20px;">
  <tr><th>Employee Name</th><td>${entry.employee.full_name}</td></tr>
  <tr><th>Job Title</th><td>${entry.employee.job_title || '-'}</td></tr>
  <tr><th>Period</th><td>${monStr} ${run.year}</td></tr>
  <tr><th>Bank</th><td>${entry.employee.bank_name || '-'}</td></tr>
  <tr><th>Account Number</th><td>${entry.employee.bank_account_number || '-'}</td></tr>
</table>
<table style="margin-top:20px;">
  <tr><th>Description</th><th>Amount (RWF)</th></tr>
  <tr><td>Gross Salary</td><td style="text-align:right;">${fmt(entry.gross_salary)}</td></tr>
  ${entry.bonus ? `<tr><td>Bonus</td><td style="text-align:right;">${fmt(entry.bonus)}</td></tr>` : ''}
  ${entry.deduction ? `<tr><td>Deduction</td><td style="text-align:right;">-${fmt(entry.deduction)}</td></tr>` : ''}
  <tr class="total-row"><td>NET SALARY</td><td style="text-align:right;">${fmt(entry.net_salary)}</td></tr>
</table>
</body>
</html>`

      return { html, filename: `Payslip-${entry.employee.full_name.replace(/\s+/g, '-')}.pdf` }
    }
  )
}
