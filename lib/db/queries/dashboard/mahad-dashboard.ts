/**
 * Lean Mahad Dashboard Queries
 *
 * Optimized queries for the Mahad admin dashboard.
 * Uses targeted selects instead of full includes to minimize payload size.
 */

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import { StudentStatus } from '@/lib/types/student'

import { StudentWithBatchData } from '../student'

const mahadDashboardSelect = {
  id: true,
  gradeLevel: true,
  schoolName: true,
  graduationStatus: true,
  paymentFrequency: true,
  billingType: true,
  paymentNotes: true,
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
          type: true,
          value: true,
        },
        take: 3,
      },
    },
  },
  enrollments: {
    where: {
      status: { not: 'WITHDRAWN' as const },
      endDate: null,
    },
    select: {
      status: true,
      batchId: true,
      batch: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: { startDate: 'desc' as const },
    take: 1,
  },
  assignments: {
    where: { isActive: true },
    select: {
      subscription: {
        select: {
          id: true,
          status: true,
          stripeSubscriptionId: true,
          amount: true,
        },
      },
    },
    take: 1,
  },
} as const satisfies Prisma.ProgramProfileSelect

type MahadProfileWithData = Prisma.ProgramProfileGetPayload<{
  select: typeof mahadDashboardSelect
}>

function enrollmentStatusToStudentStatus(
  enrollmentStatus: string
): StudentStatus {
  const mapping: Record<string, StudentStatus> = {
    REGISTERED: StudentStatus.REGISTERED,
    ENROLLED: StudentStatus.ENROLLED,
    ON_LEAVE: StudentStatus.ON_LEAVE,
    WITHDRAWN: StudentStatus.WITHDRAWN,
    COMPLETED: StudentStatus.WITHDRAWN,
    SUSPENDED: StudentStatus.WITHDRAWN,
  }
  return mapping[enrollmentStatus] ?? StudentStatus.REGISTERED
}

function mapToStudentWithBatchData(
  profile: MahadProfileWithData
): StudentWithBatchData {
  const contactPoints = profile.person.contactPoints
  const email = contactPoints.find((cp) => cp.type === 'EMAIL')?.value ?? null
  const phone =
    contactPoints.find((cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP')
      ?.value ?? null

  const enrollment = profile.enrollments?.[0]
  const subscription = profile.assignments?.[0]?.subscription

  return {
    id: profile.id,
    name: profile.person.name,
    email,
    phone,
    dateOfBirth: profile.person.dateOfBirth,
    gradeLevel: profile.gradeLevel,
    schoolName: profile.schoolName,
    graduationStatus: profile.graduationStatus,
    paymentFrequency: profile.paymentFrequency,
    billingType: profile.billingType,
    paymentNotes: profile.paymentNotes,
    status: enrollment
      ? enrollmentStatusToStudentStatus(enrollment.status)
      : StudentStatus.REGISTERED,
    batchId: enrollment?.batchId ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    batch: enrollment?.batch ?? null,
    subscription: subscription ?? null,
  }
}

/**
 * Get Mahad students with optimized dashboard data.
 * Single query that fetches all data needed for the dashboard view.
 */
export async function getMahadStudentsDashboard(
  client: DatabaseClient = prisma
): Promise<StudentWithBatchData[]> {
  const profiles = await client.programProfile.findMany({
    where: {
      program: 'MAHAD_PROGRAM',
      enrollments: {
        some: {
          status: { not: 'WITHDRAWN' },
          endDate: null,
        },
      },
    },
    select: mahadDashboardSelect,
    orderBy: { createdAt: 'desc' },
  })

  return profiles.map(mapToStudentWithBatchData)
}
