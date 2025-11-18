import { findDuplicateStudents } from '@/lib/db/queries/student'

import { DuplicateDetector } from '../components/duplicate-detection'

/**
 * Duplicates Parallel Route Slot
 *
 * Loads independently from other sections.
 * If this fails, students and batches still work.
 */
export default async function DuplicatesSlot() {
  const duplicates = await findDuplicateStudents()

  return <DuplicateDetector duplicates={duplicates} />
}
