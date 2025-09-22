'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface SkeletonRowProps {
  className?: string
}

export function StudentRowSkeleton({ className }: SkeletonRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start justify-between rounded-lg border p-4 sm:flex-row sm:items-center',
        className
      )}
    >
      <div className="mb-4 flex-1 space-y-2 sm:mb-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full sm:w-10" />
        ))}
      </div>
    </div>
  )
}

export function StudentListSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-2 w-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <StudentRowSkeleton key={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function FilterControlsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export function AttendanceHistorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                  <div className="flex gap-2">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-6 w-16" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function SessionSummarySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-1 h-4 w-16" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
