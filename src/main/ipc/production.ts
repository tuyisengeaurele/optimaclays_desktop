import type { BrickType, DefectType, MaterialType, Prisma, ProductionStage, RejectDisposition, Shift } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'
import { getDefectTypes, setDefectTypes } from './repositories/defectTypes'

type ProductionBatchWithKilnAndConsumptions = Prisma.ProductionBatchGetPayload<{
  include: { kiln: true; consumptions: true }
}>
type ProductionBatchWithKiln = Prisma.ProductionBatchGetPayload<{ include: { kiln: true } }>

type ProductionBatchResult = ProductionBatchWithKilnAndConsumptions & { defectTypes: DefectType[] }
type ProductionBatchCompleteResult = ProductionBatchWithKiln & { defectTypes: DefectType[] }

interface MaterialUsedInput {
  material_type?: MaterialType
  quantity_used?: number | string
  notes?: string
}

interface ValidatedMaterialUsed {
  material_type: MaterialType
  quantity_used: number
  notes?: string
}

// A batch only records what it is targeting for output when it starts. What actually
// came out of the kiln is only known once firing and quality check are done, so
// bricks_produced/bricks_rejected/defects are captured later through production:complete.
// Raw materials used to produce a batch (e.g. clay, sand) are recorded alongside it
// instead of only through the standalone Record Consumption action in Inventory, so a
// batch's own material usage is tracked directly and still deducts from raw stock the
// same way a standalone consumption entry does.
function validateMaterialsUsed(materials_used: unknown): ValidatedMaterialUsed[] {
  if (!Array.isArray(materials_used)) return []
  return (materials_used as MaterialUsedInput[])
    .filter((m) => m && m.material_type && Number(m.quantity_used) > 0)
    .map((m) => ({
      material_type: m.material_type as MaterialType,
      quantity_used: Number(m.quantity_used),
      notes: m.notes || undefined
    }))
}

// The three child-table conversion left ProductionBatch.defectTypes as a relation, so
// batches returned from a bulk query need their defect types attached by hand, matching
// the shape every batch had automatically when defect_types was still a scalar column.
async function attachDefectTypes<T extends { id: string }>(batches: T[]): Promise<Array<T & { defectTypes: DefectType[] }>> {
  if (batches.length === 0) return []
  const rows = await prisma.productionBatchDefectType.findMany({
    where: { productionBatchId: { in: batches.map((b) => b.id) } }
  })
  const byBatch = new Map<string, DefectType[]>()
  for (const row of rows) {
    const arr = byBatch.get(row.productionBatchId) || []
    arr.push(row.defectType)
    byBatch.set(row.productionBatchId, arr)
  }
  return batches.map((b) => ({ ...b, defectTypes: byBatch.get(b.id) || [] }))
}

interface ListBatchesPayload {
  from?: string
  to?: string
  page?: number | string
  limit?: number | string
}

interface ListBatchesResult {
  batches: ProductionBatchResult[]
  total: number
  page: number
  limit: number
}

interface StatsResult {
  daily: Array<{ date: string; produced: number; rejected: number }>
  totalProduced: number
  totalRejected: number
  rejectionRate: number | string
  defectBreakdown: Record<string, number>
}

interface CreateBatchPayload {
  date: string
  shift: Shift
  kiln_number?: string
  kilnId?: string | null
  brick_type?: BrickType
  custom_name?: string | null
  bricks_target: number
  current_stage?: ProductionStage
  materials_used?: MaterialUsedInput[]
  defectTypes?: string[]
}

interface UpdateBatchPayload {
  id: string
  date?: string
  shift?: Shift
  kiln_number?: string
  kilnId?: string | null
  brick_type?: BrickType
  custom_name?: string | null
  bricks_target?: number
  current_stage?: ProductionStage
  materials_used?: MaterialUsedInput[]
  defectTypes?: string[]
}

interface CompleteBatchPayload {
  id: string
  bricks_produced: number
  rejection_reason?: string
  defectTypes?: string[]
  reject_disposition?: RejectDisposition
}

interface DeleteBatchPayload {
  id: string
}

export function registerProductionHandlers(): void {
  handle<ListBatchesPayload, ListBatchesResult>('production:list', null, async ({ from, to, page = 1, limit = 50 }) => {
    const where: Prisma.ProductionBatchWhereInput = { deletedAt: null }
    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {})
      }
    }
    const pageNum = Number(page) || 1
    const limitNum = Number(limit) || 50
    const skip = (pageNum - 1) * limitNum

    const [batches, total] = await Promise.all([
      prisma.productionBatch.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
        include: { kiln: true, consumptions: true }
      }),
      prisma.productionBatch.count({ where })
    ])

    return { batches: await attachDefectTypes(batches), total, page: pageNum, limit: limitNum }
  })

  handle<void, StatsResult>('production:stats', null, async () => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const batches = await prisma.productionBatch.findMany({
      where: { date: { gte: thirtyDaysAgo }, deletedAt: null },
      orderBy: { date: 'asc' }
    })

    const byDate: Record<string, { produced: number; rejected: number }> = {}
    for (const b of batches) {
      const d = b.date.toISOString().slice(0, 10)
      if (!byDate[d]) byDate[d] = { produced: 0, rejected: 0 }
      byDate[d].produced += b.bricks_produced
      byDate[d].rejected += b.bricks_rejected
    }

    const daily = Object.entries(byDate).map(([date, v]) => ({ date, ...v }))
    const totalProduced = batches.reduce((s, b) => s + b.bricks_produced, 0)
    const totalRejected = batches.reduce((s, b) => s + b.bricks_rejected, 0)

    const defectRows = await prisma.productionBatchDefectType.findMany({
      where: { productionBatchId: { in: batches.map((b) => b.id) } }
    })
    const defectBreakdown: Record<string, number> = {}
    for (const row of defectRows) {
      defectBreakdown[row.defectType] = (defectBreakdown[row.defectType] || 0) + 1
    }

    return {
      daily,
      totalProduced,
      totalRejected,
      rejectionRate: totalProduced ? ((totalRejected / totalProduced) * 100).toFixed(2) : 0,
      defectBreakdown
    }
  })

  handle<CreateBatchPayload, ProductionBatchResult>(
    'production:create',
    null,
    async ({ date, shift, kiln_number, kilnId, brick_type, custom_name, bricks_target, current_stage, materials_used, defectTypes }) => {
      if (!date) throw new BadRequestError('date is required')
      if (!shift) throw new BadRequestError('shift is required')
      if (!bricks_target || Number(bricks_target) <= 0) throw new BadRequestError('bricks_target must be a positive number')
      if (current_stage === 'STOCKPILED') throw new BadRequestError('A new batch cannot start already stockpiled, complete it instead')

      const materials = validateMaterialsUsed(materials_used)
      const batchDate = new Date(date)

      const batch = await prisma.productionBatch.create({
        data: {
          date: batchDate,
          shift,
          kiln_number: kiln_number || '',
          kilnId: kilnId || null,
          brick_type: brick_type || 'BRICK_10',
          custom_name: custom_name || null,
          bricks_target: Number(bricks_target),
          current_stage: current_stage || 'RAW_MIXING',
          consumptions: materials.length
            ? { create: materials.map((m) => ({ material_type: m.material_type, quantity_used: m.quantity_used, date: batchDate, notes: m.notes || null })) }
            : undefined
        },
        include: { kiln: true, consumptions: true }
      })

      // The source schema's defect_types was a plain scalar column, settable at any point
      // in a batch's life (the source UI only ever set it via completeBatch, but nothing in
      // the model enforced that). Accepting it here too keeps create/update/complete
      // symmetric now that it is a child table wired through the same repository.
      const savedDefectTypes = await setDefectTypes(batch.id, Array.isArray(defectTypes) ? (defectTypes as DefectType[]) : [])
      return { ...batch, defectTypes: savedDefectTypes }
    }
  )

  // Updates the batch while it is still in progress: date, shift, kiln, target and stage
  // (short of completion). Produced/rejected counts are not editable here, only through
  // production:complete, so a batch's recorded output always comes from one place.
  handle<UpdateBatchPayload, ProductionBatchResult>(
    'production:update',
    null,
    async ({ id, date, shift, kiln_number, kilnId, brick_type, custom_name, bricks_target, current_stage, materials_used, defectTypes }) => {
      const batch = await prisma.productionBatch.findFirst({ where: { id, deletedAt: null } })
      if (!batch) throw new NotFoundError('Production batch not found')
      if (batch.completed_at) throw new BadRequestError('Completed batches cannot be edited')
      if (current_stage === 'STOCKPILED') throw new BadRequestError('Use the complete action to move a batch to stockpiled')

      const batchDate = date ? new Date(date) : batch.date
      const materials = materials_used !== undefined ? validateMaterialsUsed(materials_used) : null

      const updated = await prisma.$transaction(async (tx) => {
        if (materials) {
          await tx.rawMaterialConsumption.deleteMany({ where: { productionBatchId: id } })
        }
        return tx.productionBatch.update({
          where: { id },
          data: {
            date: date ? batchDate : undefined,
            shift,
            kiln_number: kiln_number || undefined,
            kilnId: kilnId !== undefined ? kilnId || null : undefined,
            brick_type,
            custom_name: custom_name !== undefined ? custom_name || null : undefined,
            bricks_target,
            current_stage,
            consumptions:
              materials && materials.length
                ? { create: materials.map((m) => ({ material_type: m.material_type, quantity_used: m.quantity_used, date: batchDate, notes: m.notes || null })) }
                : undefined
          },
          include: { kiln: true, consumptions: true }
        })
      })

      const savedDefectTypes = defectTypes !== undefined ? await setDefectTypes(id, defectTypes as DefectType[]) : await getDefectTypes(id)
      return { ...updated, defectTypes: savedDefectTypes }
    }
  )

  // Marks a batch complete: records what actually came out of the kiln and moves the
  // good output (and any downgraded rejects) into finished goods stock in one transaction,
  // so completed production always shows up as sellable inventory automatically.
  handle<CompleteBatchPayload, ProductionBatchCompleteResult>(
    'production:complete',
    null,
    async ({ id, bricks_produced, rejection_reason, defectTypes, reject_disposition }) => {
      const batch = await prisma.productionBatch.findFirst({ where: { id, deletedAt: null } })
      if (!batch) throw new NotFoundError('Production batch not found')
      if (batch.completed_at) throw new BadRequestError('Batch is already completed')

      const produced = Number(bricks_produced)
      if (bricks_produced == null || isNaN(produced) || produced < 0) throw new BadRequestError('bricks_produced must be a non-negative number')
      if (produced > batch.bricks_target) throw new BadRequestError('Produced cannot exceed the target quantity loaded')

      // Rejected is always derived from what was loaded versus what actually came out,
      // rather than trusting a client-supplied count, so it can never drift from the
      // batch's own numbers.
      const rejected = batch.bricks_target - produced
      const goodQty = produced

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.productionBatch.update({
          where: { id },
          data: {
            bricks_produced: produced,
            bricks_rejected: rejected,
            rejection_reason: rejection_reason || null,
            reject_disposition: rejected > 0 ? reject_disposition || null : null,
            current_stage: 'STOCKPILED',
            completed_at: new Date()
          },
          include: { kiln: true }
        })

        if (goodQty > 0) {
          await tx.finishedGoodsStock.create({
            data: {
              brick_type: result.brick_type,
              custom_name: result.custom_name,
              quality_grade: 'GRADE_A',
              quantity: goodQty,
              source: 'PRODUCTION',
              notes: `From batch ${result.id.slice(0, 8).toUpperCase()}`
            }
          })
        }

        // DOWNGRADE_TO_B becomes sellable Grade B stock. DISPOSE is physically thrown
        // away, so it is never counted as stock. Everything else (REWORK, or no
        // disposition set) still exists on the shelf, so it is tracked as Reject-grade
        // stock rather than disappearing from inventory once the batch is completed.
        if (rejected > 0 && reject_disposition === 'DOWNGRADE_TO_B') {
          await tx.finishedGoodsStock.create({
            data: {
              brick_type: result.brick_type,
              custom_name: result.custom_name,
              quality_grade: 'GRADE_B',
              quantity: rejected,
              source: 'PRODUCTION',
              notes: `Downgraded rejects from batch ${result.id.slice(0, 8).toUpperCase()}`
            }
          })
        } else if (rejected > 0 && reject_disposition !== 'DISPOSE') {
          await tx.finishedGoodsStock.create({
            data: {
              brick_type: result.brick_type,
              custom_name: result.custom_name,
              quality_grade: 'REJECT',
              quantity: rejected,
              source: 'PRODUCTION',
              notes: `Rejects from batch ${result.id.slice(0, 8).toUpperCase()}`
            }
          })
        }

        return result
      })

      const savedDefectTypes = await setDefectTypes(id, Array.isArray(defectTypes) ? (defectTypes as DefectType[]) : [])
      return { ...updated, defectTypes: savedDefectTypes }
    }
  )

  handle<DeleteBatchPayload, { deleted: boolean }>('production:delete', ['ADMIN', 'PRODUCTION_SUPERVISOR'], async ({ id }) => {
    const batch = await prisma.productionBatch.findFirst({ where: { id, deletedAt: null } })
    if (!batch) throw new NotFoundError('Production batch not found')
    await prisma.productionBatch.update({ where: { id }, data: { deletedAt: new Date() } })
    return { deleted: true }
  })
}
