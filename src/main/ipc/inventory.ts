import { MaterialType } from '@prisma/client'
import type {
  BrickType,
  FinishedGoodsStock,
  Prisma,
  QualityGrade,
  RawMaterialConsumption,
  StockThreshold
} from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError } from './errors'

type RawMaterialStockWithSupplier = Prisma.RawMaterialStockGetPayload<{ include: { supplier: true } }>

interface RawMaterialSummaryEntry {
  material_type: MaterialType
  current_stock: number
  unit: string
  threshold: number
  is_low: boolean
}

interface ListRawMaterialsResult {
  stocks: RawMaterialStockWithSupplier[]
  summary: RawMaterialSummaryEntry[]
}

interface AddRawMaterialPayload {
  material_type: MaterialType
  quantity: number
  unit: string
  unit_cost: number
  total_cost: number
  supplierId?: string | null
  supplier_name?: string
  date: string
  notes?: string
}

interface ConsumeRawMaterialPayload {
  material_type: MaterialType
  quantity_used: number
  date: string
  notes?: string
}

interface FinishedGoodsSummaryEntry {
  brick_type: BrickType
  quality_grade: QualityGrade
  current_stock: number
}

interface ListFinishedGoodsResult {
  stocks: FinishedGoodsStock[]
  summary: FinishedGoodsSummaryEntry[]
}

interface AddFinishedGoodsPayload {
  brick_type: BrickType
  quality_grade: QualityGrade
  quantity: number
  date?: string
  notes?: string
}

interface SetThresholdPayload {
  material_type: MaterialType
  threshold: number
  unit: string
}

export function registerInventoryHandlers(): void {
  handle<void, ListRawMaterialsResult>('inventory:listRawMaterials', null, async () => {
    const stocks = await prisma.rawMaterialStock.findMany({ orderBy: { date: 'desc' }, include: { supplier: true } })
    const consumptions = await prisma.rawMaterialConsumption.findMany()
    const thresholds = await prisma.stockThreshold.findMany()

    const types = Object.values(MaterialType)
    const summary = types.map((type) => {
      const totalIn = stocks.filter((s) => s.material_type === type).reduce((s, r) => s + r.quantity, 0)
      const totalOut = consumptions.filter((c) => c.material_type === type).reduce((s, r) => s + r.quantity_used, 0)
      const current = totalIn - totalOut
      const threshold = thresholds.find((t) => t.material_type === type)
      return {
        material_type: type,
        current_stock: current,
        unit: threshold?.unit || stocks.find((s) => s.material_type === type)?.unit || 'kg',
        threshold: threshold?.threshold || 0,
        is_low: threshold ? current <= threshold.threshold : false
      }
    })

    return { stocks, summary }
  })

  // supplier is a relation, not a free-text field. A supplier picked from the list
  // sends supplierId directly; a "not listed" name creates a real Supplier record
  // on the fly so it becomes reusable next time instead of being freeform text.
  handle<AddRawMaterialPayload, RawMaterialStockWithSupplier>(
    'inventory:addRawMaterial',
    null,
    async ({ material_type, quantity, unit, unit_cost, total_cost, supplierId, supplier_name, date, notes }) => {
      let resolvedSupplierId: string | null = supplierId || null
      if (!resolvedSupplierId && supplier_name) {
        const newSupplier = await prisma.supplier.create({ data: { name: supplier_name } })
        resolvedSupplierId = newSupplier.id
      }

      return prisma.rawMaterialStock.create({
        data: {
          material_type,
          quantity: Number(quantity),
          unit,
          unit_cost: Number(unit_cost),
          total_cost: Number(total_cost),
          supplierId: resolvedSupplierId,
          date: new Date(date),
          notes
        },
        include: { supplier: true }
      })
    }
  )

  handle<ConsumeRawMaterialPayload, RawMaterialConsumption>('inventory:consumeRawMaterial', null, async ({ material_type, quantity_used, date, notes }) =>
    prisma.rawMaterialConsumption.create({
      data: { material_type, quantity_used: Number(quantity_used), date: new Date(date), notes }
    })
  )

  handle<void, ListFinishedGoodsResult>('inventory:listFinishedGoods', null, async () => {
    const stocks = await prisma.finishedGoodsStock.findMany({ orderBy: { date: 'desc' } })

    const summary = new Map<string, FinishedGoodsSummaryEntry>()
    for (const s of stocks) {
      const key = `${s.brick_type}::${s.quality_grade}`
      const existing = summary.get(key)
      if (existing) {
        existing.current_stock += s.quantity
      } else {
        summary.set(key, { brick_type: s.brick_type, quality_grade: s.quality_grade, current_stock: s.quantity })
      }
    }

    return { stocks, summary: Array.from(summary.values()) }
  })

  handle<AddFinishedGoodsPayload, FinishedGoodsStock>('inventory:addFinishedGoods', null, async ({ brick_type, quality_grade, quantity, date, notes }) => {
    if (!brick_type || quantity == null) throw new BadRequestError('brick_type and quantity are required')
    if (!quality_grade) throw new BadRequestError('quality_grade is required')
    return prisma.finishedGoodsStock.create({
      data: {
        brick_type,
        quality_grade,
        quantity: Number(quantity),
        date: date ? new Date(date) : new Date(),
        notes: notes || null
      }
    })
  })

  handle<SetThresholdPayload, StockThreshold>('inventory:setThreshold', null, async ({ material_type, threshold, unit }) =>
    prisma.stockThreshold.upsert({
      where: { material_type },
      update: { threshold, unit },
      create: { material_type, threshold, unit }
    })
  )
}
