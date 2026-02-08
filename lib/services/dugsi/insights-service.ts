import { cache } from 'react'

import { SubscriptionStatus } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'

import {
  DugsiInsightsData,
  EnrollmentDistribution,
  ProgramHealthStats,
  RegistrationTrendItem,
  RevenueByTier,
  RevenueStats,
} from '@/app/admin/dugsi/_types/insights'
import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { createServiceLogger, logError } from '@/lib/logger'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'

const logger = createServiceLogger('dugsi-insights')

const ACTIVE_STUDENT_STATUSES = ['REGISTERED', 'ENROLLED'] as const

export const getDugsiInsights = cache(
  async function getDugsiInsights(): Promise<DugsiInsightsData> {
    return Sentry.startSpan(
      { name: 'insights.getDugsiInsights', op: 'function' },
      async () => {
        try {
          const [health, revenue, enrollment, registrationTrend] =
            await Promise.all([
              getHealthStats(),
              getRevenueStats(),
              getEnrollmentDistribution(),
              getRegistrationTrend(),
            ])

          return { health, revenue, enrollment, registrationTrend }
        } catch (error) {
          logError(logger, error, 'Failed to fetch Dugsi insights', {})
          throw error
        }
      }
    )
  }
)

async function getHealthStats(): Promise<ProgramHealthStats> {
  return Sentry.startSpan(
    { name: 'insights.getHealthStats', op: 'db' },
    async () => {
      const [totalStudents, activeStudents, familyData, paymentMethodData] =
        await Promise.all([
          prisma.programProfile.count({
            where: { program: DUGSI_PROGRAM },
          }),
          prisma.programProfile.count({
            where: {
              program: DUGSI_PROGRAM,
              status: { in: [...ACTIVE_STUDENT_STATUSES] },
            },
          }),
          getFamilyStatusBreakdown(),
          getPaymentMethodCaptureRate(),
        ])

      const totalFamilies = Object.values(familyData).reduce(
        (sum, count) => sum + count,
        0
      )

      return {
        totalFamilies,
        totalStudents,
        activeStudents,
        familyStatusBreakdown: familyData,
        paymentMethodCaptureRate: paymentMethodData,
      }
    }
  )
}

// Bug 1 fix: categorize families by ALL subscription statuses
async function getFamilyStatusBreakdown(): Promise<
  Record<SubscriptionStatus | 'none', number>
> {
  const families = await prisma.programProfile.findMany({
    where: {
      program: DUGSI_PROGRAM,
      status: { in: [...ACTIVE_STUDENT_STATUSES] },
    },
    select: {
      familyReferenceId: true,
      assignments: {
        where: { isActive: true },
        select: {
          subscription: {
            select: { status: true },
          },
        },
        take: 1,
      },
    },
    distinct: ['familyReferenceId'],
  })

  const breakdown: Record<SubscriptionStatus | 'none', number> = {
    active: 0,
    canceled: 0,
    past_due: 0,
    incomplete: 0,
    incomplete_expired: 0,
    trialing: 0,
    unpaid: 0,
    paused: 0,
    none: 0,
  }

  const seen = new Set<string>()
  for (const profile of families) {
    const key = profile.familyReferenceId ?? profile.familyReferenceId
    if (key && seen.has(key)) continue
    if (key) seen.add(key)

    const subscription = profile.assignments[0]?.subscription
    if (subscription) {
      breakdown[subscription.status]++
    } else {
      breakdown.none++
    }
  }

  return breakdown
}

async function getPaymentMethodCaptureRate(): Promise<number> {
  const [captured, total] = await Promise.all([
    prisma.billingAccount.count({
      where: {
        accountType: 'DUGSI',
        paymentMethodCaptured: true,
        subscriptions: {
          some: {
            assignments: {
              some: {
                programProfile: {
                  program: DUGSI_PROGRAM,
                  status: { in: [...ACTIVE_STUDENT_STATUSES] },
                },
              },
            },
          },
        },
      },
    }),
    prisma.billingAccount.count({
      where: {
        accountType: 'DUGSI',
        subscriptions: {
          some: {
            assignments: {
              some: {
                programProfile: {
                  program: DUGSI_PROGRAM,
                  status: { in: [...ACTIVE_STUDENT_STATUSES] },
                },
              },
            },
          },
        },
      },
    }),
  ])

  return total > 0 ? Math.round((captured / total) * 100) : 0
}

// Bug 3 fix: query Subscription directly instead of members[0]
async function getRevenueStats(): Promise<RevenueStats> {
  return Sentry.startSpan(
    { name: 'insights.getRevenueStats', op: 'db' },
    async () => {
      const [subscriptions, familyCounts] = await Promise.all([
        prisma.subscription.findMany({
          where: {
            status: 'active',
            assignments: {
              some: {
                isActive: true,
                programProfile: {
                  program: DUGSI_PROGRAM,
                  status: { in: [...ACTIVE_STUDENT_STATUSES] },
                },
              },
            },
          },
          select: {
            id: true,
            amount: true,
            assignments: {
              where: {
                isActive: true,
                programProfile: {
                  program: DUGSI_PROGRAM,
                  status: { in: [...ACTIVE_STUDENT_STATUSES] },
                },
              },
              select: {
                programProfile: {
                  select: { familyReferenceId: true },
                },
              },
            },
          },
        }),
        getFamilyChildCounts(),
      ])

      let monthlyRevenue = 0
      let expectedRevenue = 0
      let mismatchCount = 0
      const tierMap = new Map<
        number,
        { familyCount: number; expected: number; actual: number }
      >()

      for (const sub of subscriptions) {
        const familyRefId = sub.assignments[0]?.programProfile.familyReferenceId
        const childCount = familyRefId
          ? (familyCounts.get(familyRefId) ?? 1)
          : 1
        const expected = calculateDugsiRate(childCount)

        monthlyRevenue += sub.amount
        expectedRevenue += expected

        if (sub.amount !== expected) {
          mismatchCount++
        }

        const existing = tierMap.get(childCount)
        if (existing) {
          existing.familyCount++
          existing.expected += expected
          existing.actual += sub.amount
        } else {
          tierMap.set(childCount, {
            familyCount: 1,
            expected,
            actual: sub.amount,
          })
        }
      }

      const revenueByTier: RevenueByTier[] = Array.from(tierMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([childCount, data]) => ({
          tier: childCount === 1 ? '1 child' : `${childCount} children`,
          childCount,
          familyCount: data.familyCount,
          expectedRevenue: data.expected,
          actualRevenue: data.actual,
        }))

      return {
        monthlyRevenue,
        expectedRevenue,
        variance: monthlyRevenue - expectedRevenue,
        mismatchCount,
        revenueByTier,
      }
    }
  )
}

// Bug 2 fix: only count REGISTERED/ENROLLED students
async function getFamilyChildCounts(): Promise<Map<string, number>> {
  const counts = await prisma.programProfile.groupBy({
    by: ['familyReferenceId'],
    where: {
      program: DUGSI_PROGRAM,
      status: { in: [...ACTIVE_STUDENT_STATUSES] },
    },
    _count: { id: true },
  })

  const map = new Map<string, number>()
  for (const row of counts) {
    if (row.familyReferenceId) {
      map.set(row.familyReferenceId, row._count.id)
    }
  }
  return map
}

async function getEnrollmentDistribution(): Promise<EnrollmentDistribution> {
  return Sentry.startSpan(
    { name: 'insights.getEnrollmentDistribution', op: 'db' },
    async () => {
      const [shiftCounts, assignedCount, totalActive] = await Promise.all([
        prisma.programProfile.groupBy({
          by: ['shift'],
          where: {
            program: DUGSI_PROGRAM,
            status: { in: [...ACTIVE_STUDENT_STATUSES] },
            shift: { not: null },
          },
          _count: { id: true },
        }),
        prisma.dugsiClassEnrollment.count({
          where: {
            isActive: true,
            programProfile: {
              program: DUGSI_PROGRAM,
              status: { in: [...ACTIVE_STUDENT_STATUSES] },
            },
          },
        }),
        prisma.programProfile.count({
          where: {
            program: DUGSI_PROGRAM,
            status: { in: [...ACTIVE_STUDENT_STATUSES] },
          },
        }),
      ])

      const morning =
        shiftCounts.find((s) => s.shift === 'MORNING')?._count.id ?? 0
      const afternoon =
        shiftCounts.find((s) => s.shift === 'AFTERNOON')?._count.id ?? 0

      return {
        morningStudents: morning,
        afternoonStudents: afternoon,
        assignedToClass: assignedCount,
        unassignedToClass: totalActive - assignedCount,
      }
    }
  )
}

async function getRegistrationTrend(): Promise<RegistrationTrendItem[]> {
  return Sentry.startSpan(
    { name: 'insights.getRegistrationTrend', op: 'db' },
    async () => {
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
      twelveMonthsAgo.setDate(1)
      twelveMonthsAgo.setHours(0, 0, 0, 0)

      const profiles = await prisma.programProfile.findMany({
        where: {
          program: DUGSI_PROGRAM,
          status: { in: [...ACTIVE_STUDENT_STATUSES] },
          createdAt: { gte: twelveMonthsAgo },
        },
        select: {
          createdAt: true,
          familyReferenceId: true,
        },
        orderBy: { createdAt: 'asc' },
      })

      const monthMap = new Map<
        string,
        { students: number; families: Set<string> }
      >()

      // Initialize all 12 months
      for (let i = 0; i < 12; i++) {
        const d = new Date(twelveMonthsAgo)
        d.setMonth(d.getMonth() + i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthMap.set(key, { students: 0, families: new Set() })
      }

      for (const profile of profiles) {
        const d = profile.createdAt
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const bucket = monthMap.get(key)
        if (bucket) {
          bucket.students++
          if (profile.familyReferenceId) {
            bucket.families.add(profile.familyReferenceId)
          } else {
            bucket.families.add(`solo-${bucket.families.size}`)
          }
        }
      }

      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ]

      return Array.from(monthMap.entries()).map(([month, data]) => {
        const monthIdx = parseInt(month.split('-')[1]) - 1
        return {
          month,
          label: monthNames[monthIdx],
          familyCount: data.families.size,
          studentCount: data.students,
        }
      })
    }
  )
}
