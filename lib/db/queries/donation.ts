import { type Donation, type DonationStatus } from '@prisma/client'

import { prisma } from '@/lib/db'

interface DonationListOptions {
  page?: number
  pageSize?: number
  status?: DonationStatus
  isRecurring?: boolean
  dateFrom?: Date
  dateTo?: Date
}

interface DonationListResult {
  donations: Donation[]
  total: number
  page: number
  pageSize: number
}

interface DonationStats {
  oneTimeTotalCents: number
  oneTimeCount: number
  activeRecurringCount: number
  mrrCents: number
  totalDonorCount: number
  recurringPaymentCount: number
}

export async function getDonations(
  options: DonationListOptions = {}
): Promise<DonationListResult> {
  const {
    page = 1,
    pageSize = 25,
    status,
    isRecurring,
    dateFrom,
    dateTo,
  } = options

  const where = {
    ...(status ? { status } : {}),
    ...(isRecurring !== undefined ? { isRecurring } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lt: dateTo } : {}),
          },
        }
      : {}),
    NOT: [
      { stripePaymentIntentId: { startsWith: 'sub_setup_' } },
      { stripePaymentIntentId: { startsWith: 'sub_cancelled_' } },
    ],
  }

  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.donation.count({ where }),
  ])

  return { donations, total, page, pageSize }
}

interface DonationStatsOptions {
  dateFrom?: Date
  dateTo?: Date
}

export async function getDonationStats(
  options: DonationStatsOptions = {}
): Promise<DonationStats> {
  const { dateFrom, dateTo } = options
  const dateFilter =
    dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lt: dateTo } : {}),
          },
        }
      : {}

  const [
    oneTimeStats,
    recurringCount,
    recurringPayments,
    cancelledSubs,
    uniqueDonors,
  ] = await Promise.all([
    prisma.donation.aggregate({
      where: { status: 'succeeded', isRecurring: false, ...dateFilter },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.donation.count({
      where: { isRecurring: true, status: 'succeeded', ...dateFilter },
    }),
    prisma.donation.findMany({
      where: {
        isRecurring: true,
        status: 'succeeded',
        stripeSubscriptionId: { not: null },
        ...dateFilter,
      },
      select: { stripeSubscriptionId: true, amount: true },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.donation.findMany({
      where: { status: 'cancelled', stripeSubscriptionId: { not: null } },
      select: { stripeSubscriptionId: true },
    }),
    prisma.donation.findMany({
      where: { status: 'succeeded', donorEmail: { not: null } },
      select: { donorEmail: true },
      distinct: ['donorEmail'],
    }),
  ])

  const cancelledSubIds = new Set(
    cancelledSubs.map((d) => d.stripeSubscriptionId)
  )

  // MRR: latest payment amount per unique active subscription
  const latestPerSub = new Map<string, number>()
  for (const d of recurringPayments) {
    const subId = d.stripeSubscriptionId
    if (subId && !latestPerSub.has(subId) && !cancelledSubIds.has(subId)) {
      latestPerSub.set(subId, d.amount)
    }
  }

  let mrrCents = 0
  latestPerSub.forEach((amount) => {
    mrrCents += amount
  })

  return {
    oneTimeTotalCents: oneTimeStats._sum.amount ?? 0,
    oneTimeCount: oneTimeStats._count,
    activeRecurringCount: latestPerSub.size,
    mrrCents,
    totalDonorCount: uniqueDonors.length,
    recurringPaymentCount: recurringCount,
  }
}
