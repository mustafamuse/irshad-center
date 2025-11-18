import { getBatches } from '@/lib/db/queries/batch'
import { getStudentsWithBatchFiltered } from '@/lib/db/queries/student'

import { StudentsTable } from '../components/students-table'
import {
  parseSearchParams,
  type CohortSearchParams,
} from '../lib/parse-search-params'

/**
 * Students Parallel Route Slot
 *
 * Loads independently from other sections with its own search params.
 * If this fails, batches and duplicates still work.
 */

export default async function StudentsSlot({
  searchParams,
}: {
  searchParams: CohortSearchParams
}) {
  const resolvedParams = await searchParams

  // Parse filters from URL
  const filters = parseSearchParams(resolvedParams)

  // Fetch data in parallel
  // Note: getBatches() uses React cache() to deduplicate requests across slots.
  // Both @batches and @students call it, but only one DB query executes per request.
  const [batches, studentsPage] = await Promise.all([
    getBatches(),
    getStudentsWithBatchFiltered(filters),
  ])

  return (
    <StudentsTable
      students={studentsPage.students}
      batches={batches}
      totalCount={studentsPage.totalCount}
      currentPage={studentsPage.page}
      totalPages={studentsPage.totalPages}
    />
  )
}
