import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function AttendanceStatsCardSkeleton() {
  return (
    <Card className="space-y-3 p-4">
      <Skeleton className="h-4 w-[120px]" />
      <Skeleton className="h-8 w-[60px]" />
    </Card>
  )
}

export function TodaySessionsSkeleton() {
  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-[180px]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="space-y-3 p-4">
              <Skeleton className="h-5 w-[140px]" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-9 w-full" />
            </Card>
          ))}
        </div>
      </div>
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
