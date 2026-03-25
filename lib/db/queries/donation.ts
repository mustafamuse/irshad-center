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

interface MrrAggregateRow {
  mrrcents: bigint
  activerecurringcount: bigint
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

  const [oneTimeStats, recurringCount, mrrResult, donorCountRows] =
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
      prisma.$queryRaw<MrrAggregateRow[]>`
        SELECT
          COALESCE(SUM(lps.amount), 0) AS "mrrcents",
          COUNT(*) AS "activerecurringcount"
        FROM (
          SELECT DISTINCT ON (d."stripeSubscriptionId") d.amount
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
        ) lps
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

  const mrrRow = mrrResult[0]

  return {
    oneTimeTotalCents: oneTimeStats._sum.amount ?? 0,
    oneTimeCount: oneTimeStats._count,
    activeRecurringCount: Number(mrrRow?.activerecurringcount ?? 0),
    mrrCents: Number(mrrRow?.mrrcents ?? 0),
    totalDonorCount: Number(donorCountRows[0]?.count ?? 0),
    recurringPaymentCount: recurringCount,
  }
}

export interface ZakatFitrStats {
  totalCollectedCents: number
  paymentCount: number
  totalPeopleCovered: number
}

export async function getZakatFitrStats(): Promise<ZakatFitrStats> {
  const donations = await prisma.donation.findMany({
    where: {
      status: DonationStatus.succeeded,
      isRecurring: false,
      metadata: {
        path: ['source'],
        equals: 'zakat_fitr',
      },
    },
    select: {
      metadata: true,
    },
  })

  let totalPeopleCovered = 0

  for (const d of donations) {
    const meta = d.metadata as Prisma.JsonObject | null
    const numberOfPeople = meta?.numberOfPeople
    if (typeof numberOfPeople === 'string') {
      totalPeopleCovered += parseInt(numberOfPeople, 10) || 0
    }
  }

  const perPersonCents = 1300
  const totalCollectedCents = totalPeopleCovered * perPersonCents

  return {
    totalCollectedCents,
    paymentCount: donations.length,
    totalPeopleCovered,
  }
}
