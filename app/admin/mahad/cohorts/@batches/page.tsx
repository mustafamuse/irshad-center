import { getBatches } from '@/lib/db/queries/batch'
import { getStudentsWithBatch } from '@/lib/db/queries/student'

import { BatchManagement } from '../_components/batches'

/**
 * Batches Parallel Route Slot
 *
 * Loads independently from other sections.
 * If this fails, students and duplicates still work.
 */
export default async function BatchesSlot() {
  // Fetch batches and all students for counts in parallel
  // Note: getBatches() uses React cache() to deduplicate requests across slots.
  // Both @batches and @students call it, but only one DB query executes per request.
  const [batches, students] = await Promise.all([
    getBatches(),
    getStudentsWithBatch(),
  ])

  return <BatchManagement batches={batches} students={students} />
}
