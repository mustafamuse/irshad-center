import { Suspense } from 'react'

import { Metadata } from 'next'

import { getBatches } from '@/lib/db/queries/batch'
import {
  getStudentsWithBatch,
  findDuplicateStudents,
  getStudentsWithPaymentInfo,
} from '@/lib/db/queries/student'

import { BatchErrorBoundary } from './components/error-boundary'
import { MahadDashboard } from './components/mahad-dashboard'
import { Providers } from '../../../providers'

function Loading() {
  return <div className="p-4 text-muted-foreground">Loading...</div>
}

export const metadata: Metadata = {
  title: 'Cohort Management',
  description: 'Manage student cohorts and assignments',
}

export default async function CohortsPage() {
  // Fetch data in parallel
  const [batches, students, duplicateGroups, studentsWithPayment] =
    await Promise.all([
      getBatches(),
      getStudentsWithBatch(),
      findDuplicateStudents(),
      getStudentsWithPaymentInfo(),
    ])

  // Transform duplicates to match expected format
  const duplicates = duplicateGroups.map(group => ({
    name: group.email, // Using email field as the group name
    students: [group.keepRecord, ...group.duplicateRecords] as any[]
  }))

  return (
    <Providers>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            <MahadDashboard
              students={students}
              studentsWithPayment={studentsWithPayment}
              batches={batches}
              duplicates={duplicates}
            />
          </Suspense>
        </BatchErrorBoundary>
      </main>
    </Providers>
  )
}
