import { DonationStatus, Prisma, type Donation } from '@prisma/client'

import { prisma } from '@/lib/db'

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

interface MrrRow {
  stripeSubscriptionId: string
  amount: number
}

interface CountRow {
  count: bigint
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

  const [oneTimeStats, recurringCount, mrrRows, donorCountRows] =
    await Promise.all([
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
      prisma.$queryRaw<MrrRow[]>`
        SELECT DISTINCT ON (d."stripeSubscriptionId")
          d."stripeSubscriptionId",
          d.amount
        FROM "Donation" d
        WHERE d."isRecurring" = true
          AND d.status = ${DonationStatus.succeeded}
          AND d."stripeSubscriptionId" IS NOT NULL
          ${dateFrom ? Prisma.sql`AND d."paidAt" >= ${dateFrom}` : Prisma.empty}
          ${dateTo ? Prisma.sql`AND d."paidAt" < ${dateTo}` : Prisma.empty}
          AND NOT EXISTS (
            SELECT 1 FROM "Donation" c
            WHERE c."stripeSubscriptionId" = d."stripeSubscriptionId"
              AND c.status = ${DonationStatus.cancelled}
          )
        ORDER BY d."stripeSubscriptionId", d."paidAt" DESC NULLS LAST
      `,
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(DISTINCT d."donorEmail") AS count
        FROM "Donation" d
        WHERE d.status = ${DonationStatus.succeeded}
          AND d."donorEmail" IS NOT NULL
          ${dateFrom ? Prisma.sql`AND d."paidAt" >= ${dateFrom}` : Prisma.empty}
          ${dateTo ? Prisma.sql`AND d."paidAt" < ${dateTo}` : Prisma.empty}
      `,
    ])

  const mrrCents = mrrRows.reduce((sum, row) => sum + row.amount, 0)

  return {
    oneTimeTotalCents: oneTimeStats._sum.amount ?? 0,
    oneTimeCount: oneTimeStats._count,
    activeRecurringCount: mrrRows.length,
    mrrCents,
    totalDonorCount: Number(donorCountRows[0]?.count ?? 0),
    recurringPaymentCount: recurringCount,
  }
}
