export default function Loading() {
  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="mb-6 h-8 w-48 rounded bg-muted" />

        {/* Duplicate detector skeleton */}
        <div className="mb-6 rounded-lg border bg-card p-6">
          <div className="h-6 w-64 rounded bg-muted" />
        </div>

        {/* Batch grid skeleton */}
        <div className="mb-6 space-y-4">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded bg-muted" />
            ))}
          </div>
        </div>

        {/* Students table skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="h-96 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
