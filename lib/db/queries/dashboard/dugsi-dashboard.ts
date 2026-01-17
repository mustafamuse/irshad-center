/**
 * Lean Dugsi Dashboard Queries
 *
 * Optimized queries for the Dugsi admin dashboard.
 * Uses targeted selects instead of deep includes to minimize payload size.
 */

import { Prisma, Shift } from '@prisma/client'

import { DugsiRegistration } from '@/app/admin/dugsi/_types'
import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import { mapProfileListToDugsiRegistration } from '@/lib/mappers/dugsi-mapper'

const dugsiDashboardSelect = {
  id: true,
  personId: true,
  program: true,
  status: true,
  shift: true,
  familyReferenceId: true,
  gradeLevel: true,
  schoolName: true,
  createdAt: true,
  updatedAt: true,
  person: {
    select: {
      id: true,
      name: true,
      dateOfBirth: true,
      contactPoints: {
        where: { isActive: true },
        select: {
          id: true,
          type: true,
          value: true,
          isPrimary: true,
        },
        take: 3,
      },
      dependentRelationships: {
        where: { isActive: true },
        select: {
          id: true,
          guardian: {
            select: {
              id: true,
              name: true,
              contactPoints: {
                where: { isActive: true, type: { in: ['EMAIL', 'PHONE'] } },
                select: {
                  id: true,
                  type: true,
                  value: true,
                  isPrimary: true,
                },
                take: 2,
              },
            },
          },
        },
        take: 2,
      },
    },
  },
  assignments: {
    where: { isActive: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      subscription: {
        select: {
          id: true,
          stripeSubscriptionId: true,
          status: true,
          amount: true,
          paidUntil: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          billingAccount: {
            select: {
              paymentMethodCaptured: true,
              paymentMethodCapturedAt: true,
              stripeCustomerIdDugsi: true,
              paymentIntentIdDugsi: true,
              accountType: true,
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.ProgramProfileSelect

export type DugsiDashboardProfile = Prisma.ProgramProfileGetPayload<{
  select: typeof dugsiDashboardSelect
}>

export interface DugsiDashboardData {
  registrations: DugsiRegistration[]
  familyCounts: Map<string, number>
  totalFamilies: number
  totalStudents: number
}

/**
 * Get Dugsi dashboard data with optimized queries.
 * Combines registrations and family counts in a single database round-trip.
 */
export async function getDugsiDashboardData(
  filters?: { shift?: Shift },
  client: DatabaseClient = prisma
): Promise<DugsiDashboardData> {
  const [profiles, familyCountResult] = await Promise.all([
    client.programProfile.findMany({
      where: {
        program: DUGSI_PROGRAM,
        ...(filters?.shift && { shift: filters.shift }),
      },
      select: dugsiDashboardSelect,
      orderBy: { createdAt: 'desc' },
    }),
    client.programProfile.groupBy({
      by: ['familyReferenceId'],
      where: {
        program: DUGSI_PROGRAM,
        status: { in: ['REGISTERED', 'ENROLLED'] },
      },
      _count: { id: true },
    }),
  ])

  const familyCounts = new Map<string, number>()
  for (const row of familyCountResult) {
    if (row.familyReferenceId) {
      familyCounts.set(row.familyReferenceId, row._count.id)
    }
  }

  const registrations = profiles
    .map((profile) => {
      const count = profile.familyReferenceId
        ? familyCounts.get(profile.familyReferenceId) || 1
        : 1
      return mapProfileListToDugsiRegistration(profile as never, count)
    })
    .filter(Boolean) as DugsiRegistration[]

  const uniqueFamilies = new Set(
    profiles.map((p) => p.familyReferenceId).filter(Boolean)
  )

  return {
    registrations,
    familyCounts,
    totalFamilies: uniqueFamilies.size,
    totalStudents: profiles.length,
  }
}

/**
 * Get registrations only (when family counts aren't needed).
 */
export async function getDugsiRegistrationsLean(
  filters?: { shift?: Shift },
  limit?: number,
  client: DatabaseClient = prisma
): Promise<DugsiRegistration[]> {
  const { registrations } = await getDugsiDashboardData(filters, client)
  return limit ? registrations.slice(0, limit) : registrations
}
