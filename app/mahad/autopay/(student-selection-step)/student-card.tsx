import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StudentDTO } from '@/lib/actions/get-students'
import { BASE_RATE } from '@/lib/types'

interface StudentCardProps {
  student: StudentDTO
  onRemove: (studentId: string) => void
}

export function StudentCard({ student, onRemove }: StudentCardProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card/50 p-3 sm:p-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground sm:text-base">
          {student.name}
        </span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {student.siblingGroupId ? (
            <>
              <span className="text-xs text-muted-foreground line-through">
                ${BASE_RATE}
              </span>
              <span className="text-xs font-medium text-primary">
                ${student.monthlyRate}
              </span>
              <Badge variant="secondary" className="text-xs">
                Family Discount
              </Badge>
            </>
          ) : (
            <span className="text-xs font-medium text-primary">
              ${student.monthlyRate}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(student.id)}
        className="ml-2 h-8 w-8 flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
