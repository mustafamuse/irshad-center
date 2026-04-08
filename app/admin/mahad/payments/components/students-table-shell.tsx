import { type SearchParams } from 'nuqs/server'

import { paymentsSearchParamsCache } from '@/app/admin/mahad/payments/search-params'
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
import {
  getMahadStudentsPage,
  getSubscriptionMembersBatch,
} from '@/lib/db/queries/mahad-payments'

import { PaymentsPagination } from './payments-pagination'
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
    await paymentsSearchParamsCache.parse(searchParams)

  const { enrollments, totalCount } = await getMahadStudentsPage({
    page,
    take: per_page,
    sort: sort ?? undefined,
    studentName: studentName ?? undefined,
    batchId: batchId ?? undefined,
    status: status ?? undefined,
    needsBilling: needsBilling ?? undefined,
  })

  const subscriptionIds = enrollments
    .map((e) => e.programProfile.assignments[0]?.subscription?.id)
    .filter((id): id is string => id !== undefined && id !== null)

  const subscriptionMembersMap =
    await getSubscriptionMembersBatch(subscriptionIds)

  // Map to legacy format for compatibility with existing table components
  const students = enrollments.map((enrollment) => {
    const profile = enrollment.programProfile
    const person = profile.person
    const assignment = profile.assignments[0]
    const subscription = assignment?.subscription

    const email = person.email
    const phone = person.phone

    // Get subscription members from pre-fetched map (O(1) lookup)
    const subscriptionMembers =
      subscription?.id && subscriptionMembersMap.has(subscription.id)
        ? (subscriptionMembersMap.get(subscription.id)!.get(profile.id) ?? [])
        : []

    return {
      id: profile.id,
      name: person.name,
      email,
      phone,
      status: enrollment.status.toLowerCase(),
      stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
      subscriptionStatus: subscription?.status ?? null,
      // Billing configuration
      graduationStatus: profile.graduationStatus,
      paymentFrequency: profile.paymentFrequency,
      billingType: profile.billingType,
      batchId: enrollment.batchId,
      Batch: enrollment.batch,
      StudentPayment: [], // TODO: Load from StudentPayment when migrated
      subscriptionMembers,
    }
  })

  const pageCount = Math.ceil(totalCount / per_page)

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
