import { Prisma } from '@prisma/client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
} from '@/components/ui/table'
import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { SearchParams } from '@/types'

import { PaymentsPagination } from './payments-pagination'
import { StudentsDataTable } from './students-data-table'
import { StudentsMobileCards } from './students-mobile-cards'
import { StudentsTableFilters } from './students-table-filters'

type SubscriptionMember = { id: string; name: string }

/**
 * Batch fetch subscription members for multiple subscriptions.
 * Returns a Map of subscriptionId -> array of other members sharing that subscription.
 * This avoids N+1 queries when loading student lists.
 */
async function getSubscriptionMembersBatch(
  subscriptionIds: string[]
): Promise<Map<string, Map<string, SubscriptionMember[]>>> {
  if (subscriptionIds.length === 0) {
    return new Map()
  }

  // Single query to get all billing assignments for all subscriptions
  const allAssignments = await prisma.billingAssignment.findMany({
    where: {
      subscriptionId: { in: subscriptionIds },
      isActive: true,
    },
    select: {
      subscriptionId: true,
      programProfileId: true,
      programProfile: {
        select: {
          id: true,
          person: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  // Group by subscriptionId, then create member lists excluding each profile
  const subscriptionMap = new Map<string, Map<string, SubscriptionMember[]>>()

  for (const assignment of allAssignments) {
    if (!assignment.subscriptionId) continue

    if (!subscriptionMap.has(assignment.subscriptionId)) {
      subscriptionMap.set(assignment.subscriptionId, new Map())
    }

    const profileMap = subscriptionMap.get(assignment.subscriptionId)!

    // For each subscription, build a map of profileId -> other members
    for (const otherAssignment of allAssignments) {
      if (
        otherAssignment.subscriptionId === assignment.subscriptionId &&
        otherAssignment.programProfileId !== assignment.programProfileId
      ) {
        if (!profileMap.has(assignment.programProfileId)) {
          profileMap.set(assignment.programProfileId, [])
        }
        profileMap.get(assignment.programProfileId)!.push({
          id: otherAssignment.programProfile.id,
          name: otherAssignment.programProfile.person.name,
        })
      }
    }
  }

  return subscriptionMap
}

interface StudentsTableShellProps {
  searchParams: SearchParams
}

export async function StudentsTableShell({
  searchParams,
}: StudentsTableShellProps) {
  const { page, per_page, sort, studentName, batchId, status, needsBilling } =
    await searchParams

  const pageNumber = Number(page) || 1
  const take = Number(per_page) || 10
  const skip = (pageNumber - 1) * take

  const sortString = Array.isArray(sort) ? sort[0] : sort
  const [column, order] = (sortString?.split('.') || ['name', 'asc']) as [
    string,
    'asc' | 'desc',
  ]

  // Build where clause with proper Prisma typing
  const whereConditions: Prisma.EnrollmentWhereInput[] = [
    // Mahad program only
    { programProfile: { program: MAHAD_PROGRAM } },
    // Exclude Test batch
    { batch: { name: { not: 'Test' } } },
  ]

  // Handle the special "needs billing" filter
  if (needsBilling === 'true') {
    whereConditions.push(
      { status: { not: 'WITHDRAWN' } },
      // Find profiles without active billing assignments (no subscription linked)
      // Note: Type assertion to unknown needed due to Prisma limitation with { isNot: null }
      // See: https://github.com/prisma/prisma/issues/5042
      {
        programProfile: {
          assignments: {
            none: {
              isActive: true,
              subscription: { isNot: null },
            },
          },
        },
      } as unknown as Prisma.EnrollmentWhereInput
    )
  } else {
    // Regular filters
    if (studentName) {
      // Handle case where studentName could be an array
      const nameFilter = Array.isArray(studentName)
        ? studentName[0]
        : studentName
      if (nameFilter) {
        whereConditions.push({
          programProfile: {
            person: {
              name: {
                contains: nameFilter,
                mode: 'insensitive',
              },
            },
          },
        })
      }
    }
    if (batchId) {
      const batchFilter = Array.isArray(batchId) ? batchId[0] : batchId
      if (batchFilter) {
        whereConditions.push({ batchId: batchFilter })
      }
    }
    if (status) {
      const statusValue = Array.isArray(status) ? status[0] : status
      if (statusValue) {
        whereConditions.push({
          status: statusValue.toUpperCase() as
            | 'REGISTERED'
            | 'ENROLLED'
            | 'WITHDRAWN',
        })
      }
    }
  }

  // Get enrollments with related data
  const enrollments = await prisma.enrollment.findMany({
    where: {
      AND: whereConditions,
    },
    include: {
      batch: true,
      programProfile: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
          assignments: {
            where: { isActive: true },
            include: {
              subscription: true,
            },
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
  })

  // Collect all subscription IDs for batch query (fixes N+1 query)
  const subscriptionIds = enrollments
    .map((e) => e.programProfile.assignments[0]?.subscription?.id)
    .filter((id): id is string => id !== undefined && id !== null)

  // Single batch query for all subscription members
  const subscriptionMembersMap =
    await getSubscriptionMembersBatch(subscriptionIds)

  // Map to legacy format for compatibility with existing table components
  const students = enrollments.map((enrollment) => {
    const profile = enrollment.programProfile
    const person = profile.person
    const assignment = profile.assignments[0]
    const subscription = assignment?.subscription

    // Get email and phone from contact points
    const emailContact = person.contactPoints.find((cp) => cp.type === 'EMAIL')
    const phoneContact = person.contactPoints.find((cp) => cp.type === 'PHONE')

    // Get subscription members from pre-fetched map (O(1) lookup)
    const subscriptionMembers =
      subscription?.id && subscriptionMembersMap.has(subscription.id)
        ? (subscriptionMembersMap.get(subscription.id)!.get(profile.id) ?? [])
        : []

    return {
      id: profile.id,
      name: person.name,
      email: emailContact?.value ?? null,
      phone: phoneContact?.value ?? null,
      status: enrollment.status.toLowerCase(),
      stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
      subscriptionStatus: subscription?.status ?? null,
      monthlyRate: profile.monthlyRate,
      customRate: profile.customRate,
      batchId: enrollment.batchId,
      Batch: enrollment.batch,
      StudentPayment: [], // TODO: Load from StudentPayment when migrated
      subscriptionMembers,
    }
  })

  // Get total count
  const totalStudents = await prisma.enrollment.count({
    where: {
      AND: whereConditions,
    },
  })
  const pageCount = Math.ceil(totalStudents / take)

  return (
    <Card className="border-border bg-card">
      <CardHeader className="space-y-4 bg-card">
        <div>
          <CardTitle className="text-card-foreground">
            Student Overview
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            A comprehensive list of all students and their payment status.
          </CardDescription>
        </div>
        <StudentsTableFilters />
      </CardHeader>
      <CardContent className="bg-card p-0">
        {/* Desktop Table */}
        <div className="hidden md:block">
          <div className="mx-6 mb-6 rounded-lg border border-border bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">
                    Contact
                  </TableHead>
                  <TableHead className="text-muted-foreground">Batch</TableHead>
                  <TableHead className="text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Subscription
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Payments
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-card">
                <StudentsDataTable data={students} />
              </TableBody>
            </Table>
          </div>
          <div className="bg-card px-6 pb-6">
            <PaymentsPagination pageCount={pageCount} />
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="block md:hidden">
          <StudentsMobileCards data={students} />
          <PaymentsPagination pageCount={pageCount} />
        </div>
      </CardContent>
    </Card>
  )
}
