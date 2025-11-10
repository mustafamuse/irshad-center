import { Metadata } from 'next'
import { Suspense } from 'react'
import {
  getStudentsWithPaymentInfo,
  getStudentsWithBatch
} from '@/lib/db/queries/student'
import { getBatches } from '@/lib/db/queries/batch'
import { BillingOverviewDashboard } from './billing-overview-dashboard'

export const metadata: Metadata = {
  title: 'Billing Overview',
  description: 'Payment health and financial metrics dashboard',
}

function Loading() {
  return <div className="p-4 text-muted-foreground">Loading billing data...</div>
}

export default async function BillingOverviewPage() {
  // Fetch data in parallel
  const [studentsWithPayment, students, batches] = await Promise.all([
    getStudentsWithPaymentInfo(),
    getStudentsWithBatch(),
    getBatches(),
  ])

  return (
    <Suspense fallback={<Loading />}>
      <BillingOverviewDashboard
        studentsWithPayment={studentsWithPayment}
        students={students}
        batches={batches}
      />
    </Suspense>
  )
}