import type { DefectType } from '@prisma/client'
import { prisma } from '../../db'

export async function getDefectTypes(productionBatchId: string): Promise<DefectType[]> {
  const rows = await prisma.productionBatchDefectType.findMany({ where: { productionBatchId } })
  return rows.map((row) => row.defectType)
}

export async function setDefectTypes(productionBatchId: string, defectTypes: DefectType[]): Promise<DefectType[]> {
  const unique = Array.from(new Set(defectTypes))
  await prisma.$transaction([
    prisma.productionBatchDefectType.deleteMany({ where: { productionBatchId } }),
    ...(unique.length > 0
      ? [prisma.productionBatchDefectType.createMany({ data: unique.map((defectType) => ({ productionBatchId, defectType })) })]
      : [])
  ])
  return unique
}
