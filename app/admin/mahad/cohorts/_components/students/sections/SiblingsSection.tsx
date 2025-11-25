import { Users } from 'lucide-react'

import type { BatchStudentData, StudentDetailData } from '@/lib/types/batch'

interface SiblingsSectionProps {
  student: BatchStudentData | StudentDetailData
}

export function SiblingsSection({ student }: SiblingsSectionProps) {
  // TODO: Add sibling details to StudentDetailData type
  // For now, just show sibling count if available
  if (!student.siblingCount || student.siblingCount === 0) {
    return null
  }

  return (
    <div className="space-y-4 border-t pt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4" />
        Siblings ({student.siblingCount})
      </h3>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          This student has {student.siblingCount}{' '}
          {student.siblingCount === 1 ? 'sibling' : 'siblings'} enrolled.
        </p>
      </div>
    </div>
  )
}
