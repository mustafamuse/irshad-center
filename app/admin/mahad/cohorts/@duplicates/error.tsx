'use client'

import { ParallelRouteError } from '../_features/shared'

/**
 * Duplicates Slot Error Boundary
 *
 * Isolated error handling - if duplicate detection fails,
 * students and batches slots still work fine.
 */
export default function DuplicatesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ParallelRouteError
      title="Failed to Load Duplicate Detection"
      defaultMessage="An error occurred while checking for duplicates"
      error={error}
      reset={reset}
    />
  )
}
