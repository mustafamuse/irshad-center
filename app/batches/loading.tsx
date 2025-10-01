export default function Loading() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="h-8 w-48 bg-muted rounded mb-6" />

        {/* Duplicate detector skeleton */}
        <div className="rounded-lg border bg-card p-6 mb-6">
          <div className="h-6 w-64 bg-muted rounded" />
        </div>

        {/* Batch grid skeleton */}
        <div className="space-y-4 mb-6">
          <div className="h-6 w-32 bg-muted rounded" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>

        {/* Students table skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}
