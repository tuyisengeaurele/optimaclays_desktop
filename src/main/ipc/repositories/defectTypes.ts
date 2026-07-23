import type { DefectType, Prisma } from '@prisma/client'
import { prisma } from '../../db'

export async function getDefectTypes(productionBatchId: string): Promise<DefectType[]> {
  const rows = await prisma.productionBatchDefectType.findMany({ where: { productionBatchId } })
  return rows.map((row) => row.defectType)
}

// Accepts an optional transaction client so callers with a surrounding
// $transaction (e.g. production:complete, which also moves finished-goods
// stock) can keep this write atomic with the rest of their operation,
// instead of it silently committing on its own after the fact.
export async function setDefectTypes(
  productionBatchId: string,
  defectTypes: DefectType[],
  tx?: Prisma.TransactionClient
): Promise<DefectType[]> {
  const unique = Array.from(new Set(defectTypes))
  const write = async (client: Prisma.TransactionClient): Promise<void> => {
    await client.productionBatchDefectType.deleteMany({ where: { productionBatchId } })
    if (unique.length > 0) {
      await client.productionBatchDefectType.createMany({ data: unique.map((defectType) => ({ productionBatchId, defectType })) })
    }
  }
  if (tx) {
    await write(tx)
  } else {
    await prisma.$transaction((t) => write(t))
  }
  return unique
}
