'use client'

import { ParallelRouteError } from '../_features/shared'

/**
 * Batches Slot Error Boundary
 *
 * Isolated error handling - if batch management fails,
 * students and duplicates slots still work fine.
 */
export default function BatchesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ParallelRouteError
      title="Failed to Load Batch Management"
      defaultMessage="An error occurred while loading batches"
      error={error}
      reset={reset}
    />
  )
}
