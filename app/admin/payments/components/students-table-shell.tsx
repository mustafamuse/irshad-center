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
import { prisma } from '@/lib/db'
import {
  getProgramProfilesWithBilling,
  getProgramProfilesWithBillingCount,
} from '@/lib/db/queries/program-profile'
import { SearchParams, StudentWithDetails } from '@/types'

import { PaymentsPagination } from './payments-pagination'
// These components will be created in the next steps
import { StudentsDataTable } from './students-data-table'
import { StudentsMobileCards } from './students-mobile-cards'
import { StudentsTableFilters } from './students-table-filters'

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
  const [column, order] = (sortString?.split('.') as [
    string,
    'asc' | 'desc',
  ]) || ['name', 'asc']

  // Map column name to query parameter
  const orderByColumn =
    column === 'name' ? 'name' : column === 'status' ? 'status' : 'createdAt'

  // Get profiles with billing info (server-side filtering, sorting, pagination)
  const statusValue = Array.isArray(status) ? status[0] : status
  const [profiles, totalStudents] = await Promise.all([
    getProgramProfilesWithBilling({
      studentName: studentName as string | undefined,
      batchId: batchId as string | undefined,
      status: statusValue ? (statusValue.toUpperCase() as unknown) : undefined,
      needsBilling: needsBilling === 'true',
      excludeTestBatch: true,
      skip,
      take,
      orderBy: {
        column: orderByColumn,
        order: order || 'asc',
      },
    }),
    getProgramProfilesWithBillingCount({
      studentName: studentName as string | undefined,
      batchId: batchId as string | undefined,
      status: statusValue ? (statusValue.toUpperCase() as unknown) : undefined,
      needsBilling: needsBilling === 'true',
      excludeTestBatch: true,
    }),
  ])

  const paginatedProfiles = profiles

  // Collect unique subscription IDs
  const subscriptionIds = new Set<string>()
  paginatedProfiles.forEach((p) => {
    const subscriptionId = p.assignments[0]?.subscription?.stripeSubscriptionId
    if (subscriptionId) {
      subscriptionIds.add(subscriptionId)
    }
  })

  // Batch fetch all subscription members in a single query
  const subscriptionMembersMap = new Map<string, string[]>()
  if (subscriptionIds.size > 0) {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        stripeSubscriptionId: { in: Array.from(subscriptionIds) },
      },
      include: {
        assignments: {
          where: { isActive: true },
          select: {
            programProfileId: true,
          },
        },
      },
    })

    // Build map: subscriptionId -> array of profileIds
    for (const sub of subscriptions) {
      if (sub.stripeSubscriptionId) {
        const profileIds = sub.assignments.map((a) => a.programProfileId)
        subscriptionMembersMap.set(sub.stripeSubscriptionId, profileIds)
      }
    }
  }

  // Use the profiles directly - components now handle the StudentProfile structure
  // Type assertion: the query doesn't include all StudentProfile fields but components don't use them
  const studentsWithSubscriptionMembers =
    paginatedProfiles as unknown as StudentWithDetails[]

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
                <StudentsDataTable data={studentsWithSubscriptionMembers} />
              </TableBody>
            </Table>
          </div>
          <div className="bg-card px-6 pb-6">
            <PaymentsPagination pageCount={pageCount} />
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="block md:hidden">
          <StudentsMobileCards data={studentsWithSubscriptionMembers} />
          <PaymentsPagination pageCount={pageCount} />
        </div>
      </CardContent>
    </Card>
  )
}
