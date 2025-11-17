import { getBatches } from '@/lib/db/queries/batch'
import { getStudentsWithBatch } from '@/lib/db/queries/student'

import { BatchManagement } from '../components/batch-management'

/**
 * Batches Parallel Route Slot
 *
 * Loads independently from other sections.
 * If this fails, students and duplicates still work.
 */
export default async function BatchesSlot() {
  // Fetch batches and all students for counts in parallel
  // Note: getBatches() is also called in @students slot - this is intentional.
  // Parallel routes prioritize isolation over deduplication. Each slot can fail
  // independently. Consider React cache() if this becomes a performance issue.
  const [batches, students] = await Promise.all([
    getBatches(),
    getStudentsWithBatch(),
  ])

  return <BatchManagement batches={batches} students={students} />
}
