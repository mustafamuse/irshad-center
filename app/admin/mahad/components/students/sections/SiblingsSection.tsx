import { Users } from 'lucide-react'

import type { BatchStudentData, StudentDetailData } from '@/lib/types/batch'

interface SiblingsSectionProps {
  student: BatchStudentData | StudentDetailData
}

export function SiblingsSection({ student }: SiblingsSectionProps) {
  const siblingCount = student.siblingCount ?? 0

  if (siblingCount === 0) {
    return null
  }

  return (
    <div className="space-y-4 border-t pt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4" />
        Siblings ({siblingCount})
      </h3>
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-sm text-muted-foreground">
          This student has {siblingCount}{' '}
          {siblingCount === 1 ? 'sibling' : 'siblings'} in the program.
        </p>
      </div>
    </div>
  )
}
