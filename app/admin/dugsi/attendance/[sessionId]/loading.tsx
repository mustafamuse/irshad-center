export default function Loading() {
  return (
    <div className="container mx-auto pb-32">
      <div className="animate-pulse space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-7 w-7 rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-40 rounded bg-muted" />
            <div className="h-4 w-28 rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="h-5 w-5 rounded bg-muted" />
              <div className="h-5 w-32 rounded bg-muted" />
              <div className="ml-auto flex gap-2">
                <div className="h-8 w-16 rounded bg-muted" />
                <div className="h-8 w-16 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
