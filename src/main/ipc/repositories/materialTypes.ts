import type { Prisma } from '@prisma/client'
import { prisma } from '../../db'

export async function getMaterialTypes(supplierId: string): Promise<string[]> {
  const rows = await prisma.supplierMaterialType.findMany({ where: { supplierId } })
  return rows.map((row) => row.materialType)
}

// Accepts an optional transaction client so callers with a surrounding
// $transaction can keep this write atomic with the rest of their operation.
export async function setMaterialTypes(
  supplierId: string,
  materialTypes: string[],
  tx?: Prisma.TransactionClient
): Promise<string[]> {
  const unique = Array.from(new Set(materialTypes))
  const write = async (client: Prisma.TransactionClient): Promise<void> => {
    await client.supplierMaterialType.deleteMany({ where: { supplierId } })
    if (unique.length > 0) {
      await client.supplierMaterialType.createMany({ data: unique.map((materialType) => ({ supplierId, materialType })) })
    }
  }
  if (tx) {
    await write(tx)
  } else {
    await prisma.$transaction((t) => write(t))
  }
  return unique
}
