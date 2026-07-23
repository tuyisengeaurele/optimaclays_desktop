import type { Prisma } from '@prisma/client'
import { prisma } from '../../db'

export async function getPinnedKpis(userId: string): Promise<string[]> {
  const rows = await prisma.userPinnedKpi.findMany({ where: { userId } })
  return rows.map((row) => row.kpi)
}

// Accepts an optional transaction client so callers with a surrounding
// $transaction can keep this write atomic with the rest of their operation.
export async function setPinnedKpis(userId: string, kpis: string[], tx?: Prisma.TransactionClient): Promise<string[]> {
  const unique = Array.from(new Set(kpis))
  const write = async (client: Prisma.TransactionClient): Promise<void> => {
    await client.userPinnedKpi.deleteMany({ where: { userId } })
    if (unique.length > 0) {
      await client.userPinnedKpi.createMany({ data: unique.map((kpi) => ({ userId, kpi })) })
    }
  }
  if (tx) {
    await write(tx)
  } else {
    await prisma.$transaction((t) => write(t))
  }
  return unique
}
