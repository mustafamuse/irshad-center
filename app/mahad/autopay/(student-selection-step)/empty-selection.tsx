import { Users } from 'lucide-react'

export function EmptySelection() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <Users className="h-8 w-8 text-muted-foreground/50" />
      <h3 className="mt-4 text-sm font-medium">No students selected</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Search and select students to enroll in the autopay system
      </p>
    </div>
  )
}
