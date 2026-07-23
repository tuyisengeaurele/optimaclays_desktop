import type { MaterialType, Supplier } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'
import { getMaterialTypes, setMaterialTypes } from './repositories/materialTypes'

type SupplierResult = Supplier & { materialTypes: MaterialType[] }

// The material-types child-table conversion left Supplier.materialTypes as a relation, so
// suppliers returned from a bulk query need their material types attached by hand, matching
// the shape every supplier had automatically when material_types was still a scalar column.
async function attachMaterialTypes<T extends { id: string }>(suppliers: T[]): Promise<Array<T & { materialTypes: MaterialType[] }>> {
  if (suppliers.length === 0) return []
  const rows = await prisma.supplierMaterialType.findMany({
    where: { supplierId: { in: suppliers.map((s) => s.id) } }
  })
  const bySupplier = new Map<string, MaterialType[]>()
  for (const row of rows) {
    const arr = bySupplier.get(row.supplierId) || []
    arr.push(row.materialType)
    bySupplier.set(row.supplierId, arr)
  }
  return suppliers.map((s) => ({ ...s, materialTypes: bySupplier.get(s.id) || [] }))
}

interface CreateSupplierPayload {
  name: string
  contact_name?: string | null
  phone?: string | null
  materialTypes?: string[]
  payment_terms?: string | null
  notes?: string | null
}

interface UpdateSupplierPayload {
  id: string
  name?: string
  contact_name?: string | null
  phone?: string | null
  materialTypes?: string[]
  payment_terms?: string | null
  notes?: string | null
  is_active?: boolean
}

interface DeleteSupplierPayload {
  id: string
}

export function registerSupplierHandlers(): void {
  handle<void, SupplierResult[]>('suppliers:list', null, async () => {
    const suppliers = await prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    })
    return attachMaterialTypes(suppliers)
  })

  handle<CreateSupplierPayload, SupplierResult>(
    'suppliers:create',
    ['ADMIN', 'STORE_MANAGER'],
    async ({ name, contact_name, phone, materialTypes, payment_terms, notes }) => {
      if (!name?.trim()) throw new BadRequestError('name is required')
      const supplier = await prisma.supplier.create({
        data: {
          name: name.trim(),
          contact_name: contact_name || null,
          phone: phone || null,
          payment_terms: payment_terms || null,
          notes: notes || null
        }
      })
      const savedMaterialTypes = await setMaterialTypes(supplier.id, Array.isArray(materialTypes) ? (materialTypes as MaterialType[]) : [])
      return { ...supplier, materialTypes: savedMaterialTypes }
    }
  )

  handle<UpdateSupplierPayload, SupplierResult>(
    'suppliers:update',
    ['ADMIN', 'STORE_MANAGER'],
    async ({ id, name, contact_name, phone, materialTypes, payment_terms, notes, is_active }) => {
      const supplier = await prisma.supplier.findFirst({ where: { id, deletedAt: null } })
      if (!supplier) throw new NotFoundError('Supplier not found')

      const updated = await prisma.supplier.update({
        where: { id },
        data: {
          name: name?.trim() || undefined,
          contact_name: contact_name !== undefined ? contact_name || null : undefined,
          phone: phone !== undefined ? phone || null : undefined,
          payment_terms: payment_terms !== undefined ? payment_terms || null : undefined,
          notes: notes !== undefined ? notes || null : undefined,
          is_active: is_active !== undefined ? Boolean(is_active) : undefined
        }
      })

      const savedMaterialTypes =
        materialTypes !== undefined ? await setMaterialTypes(id, materialTypes as MaterialType[]) : await getMaterialTypes(id)
      return { ...updated, materialTypes: savedMaterialTypes }
    }
  )

  handle<DeleteSupplierPayload, { deleted: boolean }>('suppliers:delete', ['ADMIN'], async ({ id }) => {
    const supplier = await prisma.supplier.findFirst({ where: { id, deletedAt: null } })
    if (!supplier) throw new NotFoundError('Supplier not found')
    await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } })
    return { deleted: true }
  })
}
