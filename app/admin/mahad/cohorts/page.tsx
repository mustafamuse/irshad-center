import { Suspense } from 'react'

import { EducationLevel, GradeLevel, SubscriptionStatus } from '@prisma/client'
import { Metadata } from 'next'

import { Separator } from '@/components/ui/separator'
import { getBatches } from '@/lib/db/queries/batch'
import {
  getStudentsWithBatch,
  getStudentsWithBatchFiltered,
  findDuplicateStudents,
} from '@/lib/db/queries/student'
import { StudentStatus } from '@/lib/types/student'

import { BatchManagement } from './components/batch-management'
import { DuplicateDetector } from './components/duplicate-detection'
import { BatchErrorBoundary } from './components/error-boundary'
import { StudentsTable } from './components/students-table'
import { Providers } from '../../../providers'

function Loading() {
  return <div className="p-4 text-muted-foreground">Loading...</div>
}

export const metadata: Metadata = {
  title: 'Cohort Management',
  description: 'Manage student cohorts and assignments',
}

// Define search params type
type SearchParams = Promise<{
  search?: string
  batch?: string | string[]
  status?: string | string[]
  subscriptionStatus?: string | string[]
  educationLevel?: string | string[]
  gradeLevel?: string | string[]
  page?: string
  limit?: string
}>

// Parse and normalize search params with validation
function parseSearchParams(params: Awaited<SearchParams>) {
  // Helper to ensure array
  const toArray = (val: string | string[] | undefined): string[] => {
    if (!val) return []
    return Array.isArray(val) ? val : [val]
  }

  // Validate enum values against actual enum types
  const validStatuses = Object.values(StudentStatus)
  const validSubscriptionStatuses = Object.values(SubscriptionStatus)
  const validEducationLevels = Object.values(EducationLevel)
  const validGradeLevels = Object.values(GradeLevel)

  return {
    search: params.search || undefined,
    // Cap at 50 to prevent URL abuse
    batchIds: toArray(params.batch).slice(0, 50),
    // Filter out invalid status values from URL and cap at 20
    statuses: toArray(params.status)
      .filter((s) => validStatuses.includes(s as StudentStatus))
      .slice(0, 20),
    // Filter out invalid subscription status values from URL and cap at 20
    subscriptionStatuses: toArray(params.subscriptionStatus)
      .filter((s) =>
        validSubscriptionStatuses.includes(s as SubscriptionStatus)
      )
      .slice(0, 20),
    // Filter out invalid education level values from URL and cap at 20
    educationLevels: toArray(params.educationLevel)
      .filter((e) => validEducationLevels.includes(e as EducationLevel))
      .slice(0, 20) as EducationLevel[],
    // Filter out invalid grade level values from URL and cap at 20
    gradeLevels: toArray(params.gradeLevel)
      .filter((g) => validGradeLevels.includes(g as GradeLevel))
      .slice(0, 20) as GradeLevel[],
    page: params.page
      ? (() => {
          const parsed = parseInt(params.page, 10)
          return isNaN(parsed) ? 1 : Math.max(1, parsed)
        })()
      : 1,
    limit: params.limit
      ? (() => {
          const parsed = parseInt(params.limit, 10)
          return isNaN(parsed) ? 50 : Math.min(Math.max(1, parsed), 100)
        })()
      : 50,
  }
}

export default async function CohortsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const resolvedParams = await searchParams

  // Parse filters from URL
  const filters = parseSearchParams(resolvedParams)

  // Fetch data in parallel with server-side filtering
  // Error boundary will catch and display any database errors
  let batches, studentsPage, allStudents, duplicates

  try {
    ;[batches, studentsPage, allStudents, duplicates] = await Promise.all([
      getBatches(),
      getStudentsWithBatchFiltered(filters),
      getStudentsWithBatch(),
      findDuplicateStudents(),
    ])
  } catch (error) {
    // Log error details for debugging
    console.error('Failed to fetch cohorts data:', error)

    // Re-throw to be caught by error boundary
    throw new Error(
      error instanceof Error
        ? `Database error: ${error.message}`
        : 'Failed to load cohorts data'
    )
  }

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
            {/* BatchManagement still gets all students for counts */}
            <BatchManagement batches={batches} students={allStudents} />
          </Suspense>
        </BatchErrorBoundary>

        <Separator className="my-4 sm:my-6 lg:my-8" />

        <BatchErrorBoundary>
          <Suspense fallback={<Loading />}>
            {/* NEW: Pass pagination metadata */}
            <StudentsTable
              students={studentsPage.students}
              batches={batches}
              totalCount={studentsPage.totalCount}
              currentPage={studentsPage.page}
              totalPages={studentsPage.totalPages}
            />
          </Suspense>
        </BatchErrorBoundary>
      </main>
    </Providers>
  )
}
