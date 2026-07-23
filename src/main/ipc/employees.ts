import type { Employee, WageType } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

interface GetEmployeePayload {
  id: string
}

interface CreateEmployeePayload {
  full_name: string
  national_id: string
  job_title?: string | null
  bank_name?: string | null
  bank_account_number?: string | null
  wage_type: WageType
  base_salary?: number
  hire_date?: string | null
  phone?: string | null
}

interface UpdateEmployeePayload {
  id: string
  full_name?: string
  job_title?: string | null
  bank_name?: string | null
  bank_account_number?: string | null
  wage_type?: WageType
  base_salary?: number
  hire_date?: string | null
  phone?: string | null
  is_active?: boolean
}

interface DeleteEmployeePayload {
  id: string
}

export function registerEmployeeHandlers(): void {
  handle<void, Employee[]>('employees:list', null, async () =>
    prisma.employee.findMany({
      where: { deletedAt: null },
      orderBy: { full_name: 'asc' }
    })
  )

  handle<GetEmployeePayload, Employee>('employees:get', null, async ({ id }) => {
    const employee = await prisma.employee.findFirst({ where: { id, deletedAt: null } })
    if (!employee) throw new NotFoundError('Employee not found')
    return employee
  })

  handle<CreateEmployeePayload, Employee>(
    'employees:create',
    ['ADMIN', 'ACCOUNTANT'],
    async ({ full_name, national_id, job_title, bank_name, bank_account_number, wage_type, base_salary, hire_date, phone }) => {
      if (!full_name) throw new BadRequestError('full_name is required')
      if (!national_id) throw new BadRequestError('national_id is required')
      if (!wage_type) throw new BadRequestError('wage_type is required')

      return prisma.employee.create({
        data: {
          full_name,
          national_id,
          job_title: job_title || null,
          bank_name: bank_name || null,
          bank_account_number: bank_account_number || null,
          wage_type,
          base_salary: base_salary ? Number(base_salary) : 0,
          hire_date: hire_date ? new Date(hire_date) : null,
          phone: phone || null,
          is_active: true
        }
      })
    }
  )

  handle<UpdateEmployeePayload, Employee>(
    'employees:update',
    ['ADMIN', 'ACCOUNTANT'],
    async ({ id, full_name, job_title, bank_name, bank_account_number, wage_type, base_salary, hire_date, phone, is_active }) => {
      const employee = await prisma.employee.findFirst({ where: { id, deletedAt: null } })
      if (!employee) throw new NotFoundError('Employee not found')

      return prisma.employee.update({
        where: { id },
        data: {
          full_name: full_name ?? employee.full_name,
          job_title: job_title !== undefined ? job_title : employee.job_title,
          bank_name: bank_name !== undefined ? bank_name : employee.bank_name,
          bank_account_number: bank_account_number !== undefined ? bank_account_number : employee.bank_account_number,
          wage_type: wage_type ?? employee.wage_type,
          base_salary: base_salary !== undefined ? Number(base_salary) : employee.base_salary,
          hire_date: hire_date ? new Date(hire_date) : employee.hire_date,
          phone: phone !== undefined ? phone : employee.phone,
          is_active: is_active !== undefined ? is_active : employee.is_active
        }
      })
    }
  )

  handle<DeleteEmployeePayload, null>('employees:delete', ['ADMIN'], async ({ id }) => {
    const employee = await prisma.employee.findFirst({ where: { id, deletedAt: null } })
    if (!employee) throw new NotFoundError('Employee not found')
    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), is_active: false }
    })
    return null
  })
}
