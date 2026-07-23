import type { MaterialType } from '@prisma/client'
import { prisma } from '../../db'

export async function getMaterialTypes(supplierId: string): Promise<MaterialType[]> {
  const rows = await prisma.supplierMaterialType.findMany({ where: { supplierId } })
  return rows.map((row) => row.materialType)
}

export async function setMaterialTypes(supplierId: string, materialTypes: MaterialType[]): Promise<MaterialType[]> {
  const unique = Array.from(new Set(materialTypes))
  await prisma.$transaction([
    prisma.supplierMaterialType.deleteMany({ where: { supplierId } }),
    ...(unique.length > 0
      ? [prisma.supplierMaterialType.createMany({ data: unique.map((materialType) => ({ supplierId, materialType })) })]
      : [])
  ])
  return unique
}
