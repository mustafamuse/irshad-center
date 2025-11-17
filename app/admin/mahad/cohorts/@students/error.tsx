'use client'

import { ParallelRouteError } from '../components/parallel-route-error'

/**
 * Students Slot Error Boundary
 *
 * Isolated error handling - if students table fails,
 * batches and duplicates slots still work fine.
 */
export default function StudentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ParallelRouteError
      title="Failed to Load Students Table"
      defaultMessage="An error occurred while loading students"
      error={error}
      reset={reset}
    />
  )
}
