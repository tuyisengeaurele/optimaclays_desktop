import type { CompanySettings } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError } from './errors'
import { getPinnedKpis as getPinnedKpisRepo, setPinnedKpis } from './repositories/pinnedKpis'

interface UpdateCompanySettingsPayload {
  tin: string
  bank_name: string
  bank_account: string
  phone?: string
  email?: string
  address?: string
  director_name: string
  director_title?: string
  default_payment_terms?: string
  default_delivery_period?: string
  overdue_grace_days?: number | string
}

interface PinnedKpisResult {
  pinned_kpis: string[]
}

interface UpdatePinnedKpisPayload {
  pinned_kpis: unknown
}

export function registerSettingsHandlers(): void {
  handle<void, CompanySettings>('settings:getCompany', null, async () => {
    let settings = await prisma.companySettings.findUnique({ where: { id: 'singleton' } })
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          id: 'singleton',
          tin: '102724630',
          bank_name: 'Bank of Kigali',
          bank_account: '000490774630268',
          phone: '0788640901',
          email: 'optimaclaysltd@gmail.com',
          address: 'Rwanda, Southern Province, Muhanga, Shyogwe, Ruli',
          director_name: 'Eurelie MUREKEYISONI',
          director_title: 'Managing Director',
          default_payment_terms: '50% advance, 25% upon completion of 75% of the order, and the remaining 25% before final delivery',
          default_delivery_period: '45 days from receipt of advance payment',
          overdue_grace_days: 0
        }
      })
    }
    return settings
  })

  handle<UpdateCompanySettingsPayload, CompanySettings>(
    'settings:updateCompany',
    ['ADMIN'],
    async ({
      tin,
      bank_name,
      bank_account,
      phone,
      email,
      address,
      director_name,
      director_title,
      default_payment_terms,
      default_delivery_period,
      overdue_grace_days
    }) => {
      if (!tin) throw new BadRequestError('TIN is required')
      if (!bank_name) throw new BadRequestError('Bank name is required')
      if (!bank_account) throw new BadRequestError('Bank account is required')
      if (!director_name) throw new BadRequestError('Director name is required')

      return prisma.companySettings.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          tin: tin || '',
          bank_name: bank_name || '',
          bank_account: bank_account || '',
          phone: phone || '',
          email: email || '',
          address: address || '',
          director_name: director_name || '',
          director_title: director_title || '',
          default_payment_terms: default_payment_terms || '',
          default_delivery_period: default_delivery_period || '',
          overdue_grace_days: overdue_grace_days != null ? Number(overdue_grace_days) : 0
        },
        update: {
          tin,
          bank_name,
          bank_account,
          phone,
          email,
          address,
          director_name,
          director_title,
          default_payment_terms,
          default_delivery_period,
          overdue_grace_days: overdue_grace_days != null ? Number(overdue_grace_days) : undefined
        }
      })
    }
  )

  handle<void, PinnedKpisResult>('settings:getPinnedKpis', null, async (_payload, session) => {
    const pinned_kpis = await getPinnedKpisRepo(session.userId)
    return { pinned_kpis }
  })

  handle<UpdatePinnedKpisPayload, PinnedKpisResult>('settings:updatePinnedKpis', null, async ({ pinned_kpis }, session) => {
    if (!Array.isArray(pinned_kpis)) throw new BadRequestError('pinned_kpis must be an array')
    const updated = await setPinnedKpis(session.userId, pinned_kpis as string[])
    return { pinned_kpis: updated }
  })
}
