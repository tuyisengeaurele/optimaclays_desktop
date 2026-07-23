import { prisma } from '../../db'

export async function getPinnedKpis(userId: string): Promise<string[]> {
  const rows = await prisma.userPinnedKpi.findMany({ where: { userId } })
  return rows.map((row) => row.kpi)
}

export async function setPinnedKpis(userId: string, kpis: string[]): Promise<string[]> {
  const unique = Array.from(new Set(kpis))
  await prisma.$transaction([
    prisma.userPinnedKpi.deleteMany({ where: { userId } }),
    ...(unique.length > 0 ? [prisma.userPinnedKpi.createMany({ data: unique.map((kpi) => ({ userId, kpi })) })] : [])
  ])
  return unique
}
