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

// Helper function to get students who share the same subscription
async function getSubscriptionMembers(
  programProfileId: string,
  subscriptionId: string | null
) {
  if (!subscriptionId) {
    return []
  }

  // Find all profiles with the same subscription (excluding current)
  const subscriptionMembers = await prisma.billingAssignment.findMany({
    where: {
      subscriptionId: subscriptionId,
      programProfileId: { not: programProfileId },
      isActive: true,
    },
    select: {
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

  return subscriptionMembers.map((m) => ({
    id: m.programProfile.id,
    name: m.programProfile.person.name,
  }))
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

  // Build where clause
  // Note: Using any[] due to Prisma type system limitations with nullable relation
  // filters (subscription: { isNot: null }). The runtime behavior is correct but
  // Prisma's generated types don't support this pattern well.
  // See: https://github.com/prisma/prisma/issues/5042
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereConditions: any[] = [
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
      {
        programProfile: {
          assignments: {
            none: {
              isActive: true,
              subscription: { isNot: null },
            },
          },
        },
      }
    )
  } else {
    // Regular filters
    if (studentName) {
      whereConditions.push({
        programProfile: {
          person: {
            name: {
              contains: studentName,
              mode: 'insensitive',
            },
          },
        },
      })
    }
    if (batchId) {
      whereConditions.push({ batchId })
    }
    if (status) {
      const statusValue = Array.isArray(status) ? status[0] : status
      whereConditions.push({ status: statusValue.toUpperCase() })
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

  // Map to legacy format for compatibility with existing table components
  const students = await Promise.all(
    enrollments.map(async (enrollment) => {
      const profile = enrollment.programProfile
      const person = profile.person
      const assignment = profile.assignments[0]
      const subscription = assignment?.subscription

      // Get email and phone from contact points
      const emailContact = person.contactPoints.find(
        (cp) => cp.type === 'EMAIL'
      )
      const phoneContact = person.contactPoints.find(
        (cp) => cp.type === 'PHONE'
      )

      // Get subscription members
      const subscriptionMembers = await getSubscriptionMembers(
        profile.id,
        subscription?.id ?? null
      )

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
  )

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
