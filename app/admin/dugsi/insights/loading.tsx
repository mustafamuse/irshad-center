export default function Loading() {
  return (
    <div className="container mx-auto space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8">
      <div className="animate-pulse">
        <div className="mb-2 h-8 w-72 rounded bg-muted" />
        <div className="mb-8 h-4 w-96 rounded bg-muted" />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-muted" />
          ))}
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <div className="h-64 rounded-lg bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <div className="h-64 rounded-lg bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>

        <div className="h-72 rounded-lg bg-muted" />
      </div>
    </div>
  )
}
