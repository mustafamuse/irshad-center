import { ClosuresManager } from './components/closures-manager'

export default function ClosuresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">School Closures</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mark dates as closed. All EXPECTED attendance records for that date
          will be set to CLOSED automatically.
        </p>
      </div>

      <ClosuresManager />
    </div>
  )
}
