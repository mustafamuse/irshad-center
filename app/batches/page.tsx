import { Suspense } from 'react'

import { Metadata } from 'next'

import { Separator } from '@/components/ui/separator'
import { getBatches } from '@/lib/db/queries/batch'
import { getStudentsWithBatch, findDuplicateStudents } from '@/lib/db/queries/student'

import { Providers } from '../providers'
import { BatchManagement } from './components/batch-management'
import { DuplicateDetector } from './components/duplicate-detection'
import { BatchErrorBoundary } from './components/error-boundary'
import { StudentsTable } from './components/students-table'

function Loading() {
  return <div className="p-4 text-muted-foreground">Loading...</div>
}

export const metadata: Metadata = {
  title: 'Batch Management',
  description: 'Manage student batches and assignments',
}

export default async function BatchesPage() {
  // Fetch data in parallel
  const [batches, students, duplicates] = await Promise.all([
    getBatches(),
    getStudentsWithBatch(),
    findDuplicateStudents(),
  ])

  return (
    <Providers>
      <main className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">
        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            <DuplicateDetector duplicates={duplicates} />
          </Suspense>
        </BatchErrorBoundary>

        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            <BatchManagement batches={batches} students={students} />
          </Suspense>
        </BatchErrorBoundary>

        <Separator className="my-4 sm:my-6 lg:my-8" />

        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            <StudentsTable students={students} batches={batches} />
          </Suspense>
        </BatchErrorBoundary>
      </main>
    </Providers>
  )
}
