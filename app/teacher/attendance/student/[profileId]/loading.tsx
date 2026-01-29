export default function Loading() {
  return (
    <div className="container mx-auto animate-pulse space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded bg-muted" />
        <div className="space-y-1">
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 rounded-lg border bg-card p-3" />
        ))}
      </div>
      <div className="h-64 rounded-lg border bg-card" />
      <div className="h-48 rounded-lg border bg-card" />
    </div>
  )
}
