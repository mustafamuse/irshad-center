export default function Loading() {
  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="mb-6 h-8 w-48 rounded bg-muted" />

        {/* Stats skeleton */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg border bg-card" />
          ))}
        </div>

        {/* Filters skeleton */}
        <div className="mb-6 space-y-4">
          <div className="h-10 w-full rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-10 w-24 rounded bg-muted" />
            <div className="h-10 w-24 rounded bg-muted" />
            <div className="h-10 w-24 rounded bg-muted" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="h-96 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
