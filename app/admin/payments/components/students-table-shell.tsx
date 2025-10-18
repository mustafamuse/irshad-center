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
import { SearchParams, StudentWithDetails } from '@/types'

import { PaymentsPagination } from './payments-pagination'
// These components will be created in the next steps
import { StudentsDataTable } from './students-data-table'
import { StudentsMobileCards } from './students-mobile-cards'
import { StudentsTableFilters } from './students-table-filters'

// Helper function to get students who share the same subscription
async function getSubscriptionMembers(
  studentId: string,
  stripeSubscriptionId: string | null
) {
  if (!stripeSubscriptionId) {
    return []
  }

  // Find all students with the same subscription ID (excluding current student)
  const subscriptionMembers = await prisma.student.findMany({
    where: {
      stripeSubscriptionId: stripeSubscriptionId,
      id: { not: studentId },
    },
    select: {
      id: true,
      name: true,
    },
  })

  return subscriptionMembers
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
  const [column, order] = (sortString?.split('.') as [
    keyof StudentWithDetails,
    'asc' | 'desc',
  ]) || ['name', 'asc']

  let where: any = {}

  // Always exclude students from "Test" batch
  const baseExcludeFilter = {
    Batch: {
      name: {
        not: 'Test',
      },
    },
  }

  // Handle the special "needs billing" filter
  if (needsBilling === 'true') {
    where = {
      AND: [
        baseExcludeFilter,
        {
          status: {
            not: 'withdrawn',
          },
        },
        {
          stripeSubscriptionId: null,
        },
      ],
    }
  } else {
    // Regular filters
    where = {
      AND: [
        baseExcludeFilter,
        {
          name: {
            contains: studentName,
            mode: 'insensitive',
          },
          batchId: batchId || undefined,
          status: status || undefined,
        },
      ],
    }
  }

  const students = await prisma.student.findMany({
    where,
    include: {
      Batch: true,
      StudentPayment: {
        orderBy: {
          paidAt: 'desc',
        },
      },
    },
    orderBy: {
      [column]: order,
    },
    take,
    skip,
  })

  // Get subscription members for each student
  const studentsWithSubscriptionMembers = await Promise.all(
    students.map(async (student) => ({
      ...student,
      subscriptionMembers: await getSubscriptionMembers(
        student.id,
        student.stripeSubscriptionId
      ),
    }))
  )

  const totalStudents = await prisma.student.count({ where })
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
