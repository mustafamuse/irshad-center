export default function Loading() {
  return (
    <div className="container mx-auto space-y-6 p-3 sm:p-4 md:p-6">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="mb-6 space-y-3 text-center">
          <div className="mx-auto h-8 w-64 rounded bg-muted sm:h-10 sm:w-80" />
          <div className="mx-auto h-5 w-96 max-w-2xl rounded bg-muted px-2 sm:h-6" />
        </div>

        {/* Parent/Guardian Information Card skeleton */}
        <div className="mb-6 rounded-xl border bg-card shadow-sm ring-1 ring-gray-200 sm:rounded-2xl">
          <div className="border-b p-4 sm:p-6">
            <div className="mb-2 h-6 w-48 rounded bg-muted sm:h-7 sm:w-64" />
            <div className="h-4 w-72 rounded bg-muted sm:h-5 sm:w-96" />
          </div>
          <div className="space-y-6 p-4 sm:space-y-8 sm:p-6">
            {/* Parent 1 skeleton */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-muted sm:h-5 sm:w-5" />
                <div className="h-5 w-32 rounded bg-muted sm:h-6 sm:w-40" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="h-4 w-20 rounded bg-muted" />
                  <div className="h-10 w-full rounded-md bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-10 w-full rounded-md bg-muted" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="h-4 w-16 rounded bg-muted" />
                  <div className="h-10 w-full rounded-md bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-20 rounded bg-muted" />
                  <div className="h-10 w-full rounded-md bg-muted" />
                </div>
              </div>
            </div>

            {/* Single parent checkbox skeleton */}
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-4 w-48 rounded bg-muted" />
            </div>

            {/* Parent 2 skeleton */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-muted sm:h-5 sm:w-5" />
                <div className="h-5 w-32 rounded bg-muted sm:h-6 sm:w-40" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="h-4 w-20 rounded bg-muted" />
                  <div className="h-10 w-full rounded-md bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-10 w-full rounded-md bg-muted" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="h-4 w-16 rounded bg-muted" />
                  <div className="h-10 w-full rounded-md bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-20 rounded bg-muted" />
                  <div className="h-10 w-full rounded-md bg-muted" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Children Section Card skeleton */}
        <div className="rounded-xl border bg-card shadow-sm ring-1 ring-gray-200 sm:rounded-2xl">
          <div className="border-b p-4 sm:p-6">
            <div className="mb-2 h-6 w-48 rounded bg-muted sm:h-7 sm:w-64" />
            <div className="h-4 w-72 rounded bg-muted sm:h-5 sm:w-96" />
          </div>
          <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
            {/* Child card skeleton */}
            {[1, 2].map((i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg border-2 border-gray-200 sm:rounded-xl"
              >
                <div className="border-b bg-gray-50/50 p-3 sm:p-4">
                  <div className="h-5 w-32 rounded bg-muted sm:h-6 sm:w-40" />
                </div>
                <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
                  {/* Name fields */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="h-4 w-20 rounded bg-muted" />
                      <div className="h-10 w-full rounded-md bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="h-10 w-full rounded-md bg-muted" />
                    </div>
                  </div>

                  {/* Gender field */}
                  <div className="space-y-2">
                    <div className="h-4 w-16 rounded bg-muted" />
                    <div className="h-10 w-full rounded-md bg-muted" />
                  </div>

                  {/* Date of birth */}
                  <div className="space-y-2">
                    <div className="h-4 w-28 rounded bg-muted" />
                    <div className="h-10 w-full rounded-md bg-muted" />
                  </div>

                  {/* Education and grade */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="h-10 w-full rounded-md bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-16 rounded bg-muted" />
                      <div className="h-10 w-full rounded-md bg-muted" />
                    </div>
                  </div>

                  {/* School name */}
                  <div className="space-y-2">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-10 w-full rounded-md bg-muted" />
                  </div>

                  {/* Health info */}
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-muted" />
                    <div className="h-24 w-full rounded-md bg-muted" />
                  </div>
                </div>
              </div>
            ))}

            {/* Add child button skeleton */}
            <div className="h-11 w-full rounded-full bg-muted sm:h-12" />

            {/* Submit button skeleton */}
            <div className="h-11 w-full rounded-full bg-muted sm:h-12" />
          </div>
        </div>
      </div>
    </div>
  )
}
