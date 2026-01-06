import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 bg-card pb-2">
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent className="bg-card">
            <Skeleton className="h-8 w-[60px]" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function TableSkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="bg-card">
        <Skeleton className="h-6 w-[180px]" />
        <Skeleton className="h-4 w-[320px]" />
        <div className="flex items-center space-x-4 pt-4">
          <Skeleton className="h-10 w-[250px]" />
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-[180px]" />
        </div>
      </CardHeader>
      <CardContent className="bg-card">
        <div className="rounded-lg border border-border bg-card">
          <div className="space-y-3 bg-card p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-4 w-[140px]" />
                <Skeleton className="h-4 w-[80px]" />
                <Skeleton className="h-4 w-[60px]" />
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[80px]" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
