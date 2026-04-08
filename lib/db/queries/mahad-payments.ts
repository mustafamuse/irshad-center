import { Prisma } from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

// ============================================================================
// Stats
// ============================================================================

export async function getMahadPaymentStats(client: DatabaseClient = prisma) {
  const [
    totalStudents,
    enrolledStudents,
    registeredStudents,
    activeSubscriptions,
    totalRevenue,
  ] = await Promise.all([
    client.enrollment.count({
      where: {
        status: { not: 'WITHDRAWN' },
        programProfile: { program: MAHAD_PROGRAM },
        batch: { name: { not: 'Test' } },
      },
    }),
    client.enrollment.count({
      where: {
        status: 'ENROLLED',
        programProfile: { program: MAHAD_PROGRAM },
        batch: { name: { not: 'Test' } },
      },
    }),
    client.enrollment.count({
      where: {
        status: 'REGISTERED',
        programProfile: { program: MAHAD_PROGRAM },
        batch: { name: { not: 'Test' } },
      },
    }),
    client.billingAssignment.count({
      where: {
        isActive: true,
        subscription: { status: 'active' },
        programProfile: { program: MAHAD_PROGRAM },
      },
    }),
    client.studentPayment.aggregate({
      _sum: { amountPaid: true },
      where: { ProgramProfile: { program: MAHAD_PROGRAM } },
    }),
  ])

  return {
    totalStudents,
    enrolledStudents,
    registeredStudents,
    activeSubscriptions,
    totalRevenue: totalRevenue._sum.amountPaid ?? 0,
  }
}

// ============================================================================
// Subscription members (avoids N+1 on student table)
// ============================================================================

type SubscriptionMember = { id: string; name: string }

export async function getSubscriptionMembersBatch(
  subscriptionIds: string[],
  client: DatabaseClient = prisma
): Promise<Map<string, Map<string, SubscriptionMember[]>>> {
  if (subscriptionIds.length === 0) return new Map()

  const allAssignments = await client.billingAssignment.findMany({
    where: { subscriptionId: { in: subscriptionIds }, isActive: true },
    relationLoadStrategy: 'join',
    select: {
      subscriptionId: true,
      programProfileId: true,
      programProfile: {
        select: { id: true, person: { select: { name: true } } },
      },
    },
  })

  const assignmentsBySubscription = new Map<string, typeof allAssignments>()
  for (const assignment of allAssignments) {
    if (!assignment.subscriptionId) continue
    const existing = assignmentsBySubscription.get(assignment.subscriptionId)
    if (existing) {
      existing.push(assignment)
    } else {
      assignmentsBySubscription.set(assignment.subscriptionId, [assignment])
    }
  }

  const subscriptionMap = new Map<string, Map<string, SubscriptionMember[]>>()
  assignmentsBySubscription.forEach(
    (subscriptionAssignments, subscriptionId) => {
      const profileMap = new Map<string, SubscriptionMember[]>()
      for (const assignment of subscriptionAssignments) {
        const otherMembers = subscriptionAssignments
          .filter((a) => a.programProfileId !== assignment.programProfileId)
          .map((a) => ({
            id: a.programProfile.id,
            name: a.programProfile.person.name,
          }))
        profileMap.set(assignment.programProfileId, otherMembers)
      }
      subscriptionMap.set(subscriptionId, profileMap)
    }
  )

  return subscriptionMap
}

// ============================================================================
// Paginated student list
// ============================================================================

export interface MahadStudentsPageParams {
  page: number
  take: number
  sort?: string
  studentName?: string
  batchId?: string
  status?: string
  needsBilling?: string
}

export async function getMahadStudentsPage(
  params: MahadStudentsPageParams,
  client: DatabaseClient = prisma
) {
  const { page, take, sort, studentName, batchId, status, needsBilling } =
    params
  const skip = (page - 1) * take

  const [column, order] = (sort?.split('.') ?? ['name', 'asc']) as [
    string,
    'asc' | 'desc',
  ]

  const whereConditions: Prisma.EnrollmentWhereInput[] = [
    { programProfile: { program: MAHAD_PROGRAM } },
    { batch: { name: { not: 'Test' } } },
  ]

  if (needsBilling === 'true') {
    whereConditions.push({ status: { not: 'WITHDRAWN' } }, {
      programProfile: {
        assignments: {
          none: { isActive: true, subscription: { isNot: null } },
        },
      },
    } as unknown as Prisma.EnrollmentWhereInput)
  } else {
    if (studentName) {
      whereConditions.push({
        programProfile: {
          person: { name: { contains: studentName, mode: 'insensitive' } },
        },
      })
    }
    if (batchId) {
      whereConditions.push({ batchId })
    }
    if (status) {
      whereConditions.push({
        status: status.toUpperCase() as 'REGISTERED' | 'ENROLLED' | 'WITHDRAWN',
      })
    } else {
      whereConditions.push({ status: { not: 'WITHDRAWN' } })
    }
  }

  const where: Prisma.EnrollmentWhereInput = { AND: whereConditions }

  const [enrollments, totalCount] = await Promise.all([
    client.enrollment.findMany({
      where,
      relationLoadStrategy: 'join',
      include: {
        batch: true,
        programProfile: {
          include: {
            person: true,
            assignments: {
              where: { isActive: true },
              include: { subscription: true },
            },
          },
        },
      },
      orderBy:
        column === 'name'
          ? { programProfile: { person: { name: order } } }
          : { [column]: order },
      take,
      skip,
    }),
    client.enrollment.count({ where }),
  ])

  return { enrollments, totalCount }
}
