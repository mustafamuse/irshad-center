import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Duplicates Loading Skeleton
 *
 * Shows while duplicate detection query is running
 */
export default function DuplicatesLoading() {
  return (
    <Card
      role="status"
      aria-live="polite"
      aria-label="Loading duplicate detection"
    >
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-96" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  )
}
