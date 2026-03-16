import { DonationStatus, type Donation } from '@prisma/client'

import { prisma } from '@/lib/db'
import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('donation-queries')
const STATS_QUERY_LIMIT = 5000

interface DonationListOptions {
  page?: number
  pageSize?: number
  status?: DonationStatus | DonationStatus[]
  isRecurring?: boolean
  dateFrom?: Date
  dateTo?: Date
  includePendingSetup?: boolean
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
    includePendingSetup = false,
  } = options

  const statusFilter = status
    ? { status: Array.isArray(status) ? { in: status } : status }
    : {}

  const where = {
    ...statusFilter,
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
      ...(includePendingSetup
        ? []
        : [{ stripePaymentIntentId: { startsWith: 'sub_setup_' } }]),
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
      where: {
        status: DonationStatus.succeeded,
        isRecurring: false,
        ...dateFilter,
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.donation.count({
      where: {
        isRecurring: true,
        status: DonationStatus.succeeded,
        ...dateFilter,
      },
    }),
    prisma.donation.findMany({
      where: {
        isRecurring: true,
        status: DonationStatus.succeeded,
        stripeSubscriptionId: { not: null },
        ...dateFilter,
      },
      select: { stripeSubscriptionId: true, amount: true },
      orderBy: { paidAt: 'desc' },
      take: STATS_QUERY_LIMIT,
    }),
    prisma.donation.findMany({
      where: {
        status: DonationStatus.cancelled,
        stripeSubscriptionId: { not: null },
      },
      select: { stripeSubscriptionId: true },
      take: STATS_QUERY_LIMIT,
    }),
    prisma.donation.findMany({
      where: {
        status: DonationStatus.succeeded,
        donorEmail: { not: null },
      },
      select: { donorEmail: true },
      distinct: ['donorEmail'],
      take: STATS_QUERY_LIMIT,
    }),
  ])

  if (
    recurringPayments.length === STATS_QUERY_LIMIT ||
    cancelledSubs.length === STATS_QUERY_LIMIT ||
    uniqueDonors.length === STATS_QUERY_LIMIT
  ) {
    logger.warn(
      {
        recurringPayments: recurringPayments.length,
        cancelledSubs: cancelledSubs.length,
        uniqueDonors: uniqueDonors.length,
        limit: STATS_QUERY_LIMIT,
      },
      'getDonationStats query hit row limit -- stats may be incomplete'
    )
  }

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
