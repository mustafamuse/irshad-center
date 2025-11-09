import { Suspense } from 'react'
import { InvoiceStatsCards } from './components/invoice-stats-cards'
import { InvoiceDataTable } from './components/invoice-data-table'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { prisma } from '@/lib/db'
import { getStudentsWithPaymentInfo, getStudentsWithBatch } from '@/lib/db/queries/student'
import { syncInvoicesFromStripe } from './actions'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// Force dynamic rendering for admin pages
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Invoices & Payments | Billing',
  description: 'Track student payments, invoices, and subscription status.',
}

// Loading skeleton components
function InvoiceStatsCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-24 w-full" />
        </Card>
      ))}
    </div>
  )
}

function InvoiceTableSkeleton() {
  return (
    <Card className="p-6">
      <Skeleton className="mb-4 h-10 w-full" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </Card>
  )
}

// Sync button component
function SyncInvoicesButton() {
  async function handleSync() {
    'use server'
    await syncInvoicesFromStripe()
  }

  return (
    <form action={handleSync}>
      <Button variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Sync from Stripe
      </Button>
    </form>
  )
}

// Data fetching component for the table
async function InvoiceTableShell() {
  const [students, payments, studentsWithPayment] = await Promise.all([
    getStudentsWithBatch(),
    prisma.studentPayment.findMany({
      orderBy: {
        paidAt: 'desc',
      },
    }),
    getStudentsWithPaymentInfo(),
  ])

  return (
    <InvoiceDataTable
      students={students}
      payments={payments}
      studentsWithPayment={studentsWithPayment}
    />
  )
}

export default async function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Invoices & Payment Tracking
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            View payment history, manage subscriptions, and track invoices
          </p>
        </div>
        <SyncInvoicesButton />
      </div>

      <Suspense fallback={<InvoiceStatsCardsSkeleton />}>
        <InvoiceStatsCards />
      </Suspense>

      <Suspense fallback={<InvoiceTableSkeleton />}>
        <InvoiceTableShell />
      </Suspense>
    </div>
  )
}