import { Skeleton } from '@/components/ui/skeleton'

export default function MahadFormsLoading() {
  return (
    <div className="space-y-6">
      <div className="mb-10 space-y-3 text-center">
        <Skeleton className="mx-auto h-9 w-72 sm:h-10" />
        <Skeleton className="mx-auto h-4 w-96 max-w-full" />
      </div>
      <div className="space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 md:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
        <Skeleton className="h-14 rounded-full md:h-12" />
      </div>
    </div>
  )
}
