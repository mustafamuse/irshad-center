import { Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { BatchStudentData } from '@/lib/types/batch'

interface SiblingsSectionProps {
  student: BatchStudentData
}

function getStudentStatusDisplay(status: string | null): string {
  if (!status) return 'Unknown'
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export function SiblingsSection({ student }: SiblingsSectionProps) {
  if (!student.Sibling || student.Sibling.Student.length === 0) {
    return null
  }

  return (
    <div className="space-y-4 border-t pt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4" />
        Siblings ({student.Sibling.Student.length})
      </h3>
      <div className="space-y-2">
        {student.Sibling.Student.map((sibling) => (
          <div
            key={sibling.id}
            className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
          >
            <span className="text-sm font-medium">{sibling.name}</span>
            <Badge variant="outline" className="text-xs font-normal">
              {getStudentStatusDisplay(sibling.status)}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
