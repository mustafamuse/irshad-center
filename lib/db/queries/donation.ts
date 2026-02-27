import { prisma } from '@/lib/db'

interface DonationListOptions {
  page?: number
  pageSize?: number
  status?: string
  isRecurring?: boolean
}

export async function getDonations(options: DonationListOptions = {}) {
  const { page = 1, pageSize = 25, status, isRecurring } = options

  const where = {
    ...(status ? { status } : {}),
    ...(isRecurring !== undefined ? { isRecurring } : {}),
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

export async function getDonationStats() {
  const [
    oneTimeStats,
    recurringCount,
    recurringForMrr,
    cancelledSubs,
    donorCount,
  ] = await Promise.all([
    prisma.donation.aggregate({
      where: { status: 'succeeded', isRecurring: false },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.donation.count({
      where: { isRecurring: true, status: 'succeeded' },
    }),
    prisma.donation.findMany({
      where: {
        isRecurring: true,
        status: 'succeeded',
        stripeSubscriptionId: { not: null },
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

  // MRR = sum of the latest payment amount per unique active subscription
  const latestPerSub = new Map<string, number>()
  for (const d of recurringForMrr) {
    if (
      d.stripeSubscriptionId &&
      !latestPerSub.has(d.stripeSubscriptionId) &&
      !cancelledSubIds.has(d.stripeSubscriptionId)
    ) {
      latestPerSub.set(d.stripeSubscriptionId, d.amount)
    }
  }
  const mrrCents = Array.from(latestPerSub.values()).reduce(
    (sum, amt) => sum + amt,
    0
  )

  return {
    oneTimeTotalCents: oneTimeStats._sum.amount ?? 0,
    oneTimeCount: oneTimeStats._count,
    activeRecurringCount: latestPerSub.size,
    mrrCents,
    totalDonorCount: donorCount.length,
    recurringPaymentCount: recurringCount,
  }
}

export async function getRecurringDonations() {
  return prisma.donation.findMany({
    where: {
      isRecurring: true,
      status: 'succeeded',
      stripeSubscriptionId: { not: null },
    },
    orderBy: { paidAt: 'desc' },
  })
}
