import type { AttendanceLog, AttendanceStatus, Employee } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

// MONTHLY staff are paid a flat base_salary regardless of daily attendance, so their
// wage_earned is left unused. PIECE_RATE depends on actual output for that day, which
// nobody can guess, so it always starts at 0 for manual entry. DAILY workers are the
// only ones with a sensible default: base_salary as the day rate, halved for a half
// day, zero for absence, all still editable afterward.
function defaultWage(employee: Pick<Employee, 'wage_type' | 'base_salary'>, status: string): number {
  if (employee.wage_type !== 'DAILY') return 0
  switch (status) {
    case 'PRESENT':
      return employee.base_salary || 0
    case 'HALF_DAY':
      return (employee.base_salary || 0) / 2
    default:
      return 0
  }
}

interface ListAttendancePayload {
  employeeId?: string
  month?: number | string
  year?: number | string
}

interface AttendanceEntryInput {
  employeeId: string
  date: string
  status: AttendanceStatus
  notes?: string
  wage_earned?: number
}

interface CreateAttendancePayload {
  entries?: AttendanceEntryInput[]
  employeeId?: string
  date?: string
  status?: AttendanceStatus
  notes?: string
  wage_earned?: number
}

interface UpdateAttendancePayload {
  id: string
  status?: AttendanceStatus
  notes?: string
  wage_earned?: number
}

interface MonthlySummaryPayload {
  employeeId?: string
  month?: number | string
  year?: number | string
}

interface MonthlySummary {
  total: number
  present: number
  absent: number
  halfDay: number
  leave: number
}

export function registerAttendanceHandlers(): void {
  handle<ListAttendancePayload, Array<AttendanceLog & { employee: Employee }>>('attendance:list', null, async ({ employeeId, month, year }) => {
    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId
    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1)
      const end = new Date(Number(year), Number(month), 1)
      where.date = { gte: start, lt: end }
    }
    return prisma.attendanceLog.findMany({
      where,
      include: { employee: true },
      orderBy: { date: 'desc' }
    })
  })

  handle<CreateAttendancePayload, AttendanceLog[] | (AttendanceLog & { employee: Employee })>(
    'attendance:create',
    ['ADMIN', 'PRODUCTION_SUPERVISOR', 'ACCOUNTANT'],
    async (payload) => {
      // Bulk: { entries: [{ employeeId, date, status, notes, wage_earned? }] }
      if (Array.isArray(payload.entries)) {
        const employeeIds = payload.entries.map((e) => e.employeeId)
        const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } } })
        const employeeById = new Map(employees.map((e) => [e.id, e]))

        return Promise.all(
          payload.entries.map((entry) => {
            const employee = employeeById.get(entry.employeeId)
            const wage = entry.wage_earned != null ? Number(entry.wage_earned) : employee ? defaultWage(employee, entry.status) : 0
            return prisma.attendanceLog.upsert({
              where: { employeeId_date: { employeeId: entry.employeeId, date: new Date(entry.date) } },
              update: { status: entry.status, notes: entry.notes, wage_earned: wage },
              create: { employeeId: entry.employeeId, date: new Date(entry.date), status: entry.status, notes: entry.notes, wage_earned: wage }
            })
          })
        )
      }

      const { employeeId, date, status, notes, wage_earned } = payload as CreateAttendancePayload & {
        employeeId: string
        date: string
        status: AttendanceStatus
      }
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
      if (!employee) throw new NotFoundError('Employee not found')
      const wage = wage_earned != null ? Number(wage_earned) : defaultWage(employee, status)

      return prisma.attendanceLog.upsert({
        where: { employeeId_date: { employeeId, date: new Date(date) } },
        update: { status, notes, wage_earned: wage },
        create: { employeeId, date: new Date(date), status, notes, wage_earned: wage },
        include: { employee: true }
      })
    }
  )

  handle<UpdateAttendancePayload, AttendanceLog & { employee: Employee }>(
    'attendance:update',
    ['ADMIN', 'PRODUCTION_SUPERVISOR', 'ACCOUNTANT'],
    async ({ id, status, notes, wage_earned }) => {
      const log = await prisma.attendanceLog.findUnique({ where: { id }, include: { employee: true } })
      if (!log) throw new NotFoundError('Attendance log not found')
      const resolvedStatus = status ?? log.status
      const wage = wage_earned != null ? Number(wage_earned) : status ? defaultWage(log.employee, resolvedStatus) : log.wage_earned

      return prisma.attendanceLog.update({
        where: { id },
        data: { status, notes, wage_earned: wage },
        include: { employee: true }
      })
    }
  )

  handle<MonthlySummaryPayload, MonthlySummary>('attendance:summary', null, async ({ employeeId, month, year }) => {
    if (!employeeId || !month || !year) throw new BadRequestError('employeeId, month, and year are required')
    const m = Number(month)
    const y = Number(year)
    if (isNaN(m) || isNaN(y) || m < 1 || m > 12) throw new BadRequestError('Invalid month or year')
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 1)

    const logs = await prisma.attendanceLog.findMany({
      where: { employeeId, date: { gte: start, lt: end } }
    })

    return {
      total: logs.length,
      present: logs.filter((l) => l.status === 'PRESENT').length,
      absent: logs.filter((l) => l.status === 'ABSENT').length,
      halfDay: logs.filter((l) => l.status === 'HALF_DAY').length,
      leave: logs.filter((l) => l.status === 'LEAVE').length
    }
  })
}
