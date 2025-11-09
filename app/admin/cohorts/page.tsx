import { Metadata } from 'next'
import { Suspense } from 'react'
import { getBatches } from '@/lib/db/queries/batch'
import { getStudentsWithBatch } from '@/lib/db/queries/student'
import { CohortsDashboard } from './cohorts-dashboard'
import { Providers } from '@/app/providers'

export const metadata: Metadata = {
  title: 'Cohorts | Admin',
  description: 'Manage student cohorts and batch assignments',
}

function Loading() {
  return <div className="p-4 text-muted-foreground">Loading cohorts...</div>
}

export default async function CohortsPage() {
  // Fetch data in parallel
  const [batches, students] = await Promise.all([
    getBatches(),
    getStudentsWithBatch(),
  ])

  return (
    <Providers>
      <Suspense fallback={<Loading />}>
        <CohortsDashboard
          batches={batches}
          students={students}
        />
      </Suspense>
    </Providers>
  )
}