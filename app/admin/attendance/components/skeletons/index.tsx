'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// Simple skeleton for loading states - used in main page
export function AttendanceStatsCardSkeleton() {
  return (
    <Card className="space-y-3 p-4">
      <Skeleton className="h-4 w-[120px]" />
      <Skeleton className="h-8 w-[60px]" />
    </Card>
  )
}

export function SessionsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-4 w-[300px]" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  )
}
