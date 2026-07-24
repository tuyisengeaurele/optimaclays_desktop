import type { Customer, CustomerType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'

type CustomerWithOrders = Prisma.CustomerGetPayload<{ include: { orders: true } }>

interface CreateCustomerPayload {
  customer_type: CustomerType
  full_name?: string | null
  company_name?: string | null
  tin_number?: string | null
  phone?: string | null
  location?: string | null
  notes?: string | null
  contact_person_name?: string | null
  contact_person_phone?: string | null
  credit_limit?: number
}

interface GetCustomerPayload {
  id: string
}

interface UpdateCustomerPayload {
  id: string
  full_name?: string | null
  company_name?: string | null
  tin_number?: string | null
  phone?: string | null
  location?: string | null
  notes?: string | null
  contact_person_name?: string | null
  contact_person_phone?: string | null
  credit_limit?: number
}

interface DeleteCustomerPayload {
  id: string
}

export function registerCustomerHandlers(): void {
  handle<void, Customer[]>('customers:list', null, async () =>
    prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    })
  )

  handle<CreateCustomerPayload, Customer>(
    'customers:create',
    null,
    async ({
      customer_type,
      full_name,
      company_name,
      tin_number,
      phone,
      location,
      notes,
      contact_person_name,
      contact_person_phone,
      credit_limit
    }) => {
      if (!customer_type) throw new BadRequestError('customer_type is required')
      if (customer_type === 'INDIVIDUAL' && !full_name) throw new BadRequestError('full_name is required for individual customers')
      if (customer_type === 'COMPANY' && !company_name) throw new BadRequestError('company_name is required for company customers')
      if (customer_type === 'COMPANY' && !tin_number) throw new BadRequestError('TIN number is required for company customers')

      return prisma.customer.create({
        data: {
          customer_type,
          full_name: full_name || null,
          company_name: company_name || null,
          tin_number: tin_number || null,
          phone: phone || null,
          location: location || null,
          notes: notes || null,
          contact_person_name: contact_person_name || null,
          contact_person_phone: contact_person_phone || null,
          credit_limit: credit_limit != null ? Number(credit_limit) : 0
        }
      })
    },
    { resource: 'customer', action: 'CREATE' }
  )

  handle<GetCustomerPayload, CustomerWithOrders>('customers:get', null, async ({ id }) => {
    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: { orders: { where: { deletedAt: null } } }
    })
    if (!customer) throw new NotFoundError('Customer not found')
    return customer
  })

  handle<UpdateCustomerPayload, Customer>(
    'customers:update',
    null,
    async ({
      id,
      full_name,
      company_name,
      tin_number,
      phone,
      location,
      notes,
      contact_person_name,
      contact_person_phone,
      credit_limit
    }) => {
      const customer = await prisma.customer.findFirst({ where: { id, deletedAt: null } })
      if (!customer) throw new NotFoundError('Customer not found')

      return prisma.customer.update({
        where: { id },
        data: {
          full_name: full_name ?? customer.full_name,
          company_name: company_name ?? customer.company_name,
          tin_number: tin_number ?? customer.tin_number,
          phone: phone ?? customer.phone,
          location: location ?? customer.location,
          notes: notes ?? customer.notes,
          contact_person_name: contact_person_name ?? customer.contact_person_name,
          contact_person_phone: contact_person_phone ?? customer.contact_person_phone,
          credit_limit: credit_limit != null ? Number(credit_limit) : customer.credit_limit
        }
      })
    },
    { resource: 'customer', action: 'UPDATE' }
  )

  handle<DeleteCustomerPayload, { deleted: boolean }>(
    'customers:delete',
    null,
    async ({ id }) => {
      const customer = await prisma.customer.findFirst({ where: { id, deletedAt: null } })
      if (!customer) throw new NotFoundError('Customer not found')
      await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } })
      return { deleted: true }
    },
    { resource: 'customer', action: 'DELETE' }
  )
}
