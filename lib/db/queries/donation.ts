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
  const [oneTimeStats, recurringCount, mrrResult, donorCount] =
    await Promise.all([
      prisma.donation.aggregate({
        where: { status: 'succeeded', isRecurring: false },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.donation.count({
        where: { isRecurring: true, status: 'succeeded' },
      }),
      prisma.subscription.aggregate({
        where: {
          stripeAccountType: 'GENERAL_DONATION',
          status: 'active',
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.donation.findMany({
        where: { status: 'succeeded', donorEmail: { not: null } },
        select: { donorEmail: true },
        distinct: ['donorEmail'],
      }),
    ])

  return {
    oneTimeTotalCents: oneTimeStats._sum.amount ?? 0,
    oneTimeCount: oneTimeStats._count,
    activeRecurringCount: mrrResult._count,
    mrrCents: mrrResult._sum.amount ?? 0,
    totalDonorCount: donorCount.length,
    recurringPaymentCount: recurringCount,
  }
}

export async function getRecurringDonations() {
  return prisma.subscription.findMany({
    where: {
      stripeAccountType: 'GENERAL_DONATION',
      status: { in: ['active', 'trialing', 'past_due'] },
    },
    orderBy: { createdAt: 'desc' },
  })
}
