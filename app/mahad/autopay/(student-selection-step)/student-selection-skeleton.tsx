import { Skeleton } from '@/components/ui/skeleton'

export function StudentSelectionSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  )
}

export function StudentListSkeleton() {
  return (
    <div className="space-y-3">
      <StudentSelectionSkeleton />
      <StudentSelectionSkeleton />
      <StudentSelectionSkeleton />
    </div>
  )
}
