'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { CopyableText } from './copyable-text'
import { PhoneContact } from './phone-contact'
import { BatchStudentData } from '@/lib/types/batch'

interface StudentCardProps {
  student: BatchStudentData
  isSelected: boolean
  onToggle: () => void
  selectable: boolean
  compact?: boolean
}

export function StudentCard({
  student,
  isSelected,
  onToggle,
  selectable,
  compact = false,
}: StudentCardProps) {
  const handleClick = () => {
    if (selectable) {
      onToggle()
    }
  }

  return (
    <Card
      className={cn(
        'transition-all',
        selectable && 'cursor-pointer hover:bg-accent',
        isSelected && 'border-primary bg-primary/5',
        compact ? 'p-2' : 'p-3'
      )}
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        {selectable && (
          <Checkbox
            checked={isSelected}
            onChange={onToggle}
            className="shrink-0"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'truncate font-medium',
                  compact ? 'text-sm' : 'text-sm sm:text-base'
                )}
              >
                {student.name}
              </p>

              {!compact && student.email && (
                <div onClick={(e) => e.stopPropagation()}>
                  <CopyableText
                    text={student.email}
                    label="email"
                    className="text-xs text-muted-foreground sm:text-sm"
                  >
                    <p className="truncate">{student.email}</p>
                  </CopyableText>
                </div>
              )}

              {!compact && student.phone && (
                <div onClick={(e) => e.stopPropagation()}>
                  <PhoneContact
                    phone={student.phone}
                    name={student.name}
                    className="text-xs text-muted-foreground sm:text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-1">
              <Badge
                variant={student.status === 'ACTIVE' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {student.status}
              </Badge>

              {student.batch && (
                <Badge variant="outline" className="text-xs">
                  {student.batch.name}
                </Badge>
              )}

              {student.educationLevel && (
                <span className="text-xs text-muted-foreground">
                  {student.educationLevel}
                </span>
              )}
            </div>
          </div>

          {!compact &&
            student.siblingGroup &&
            student.siblingGroup.students.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  Siblings:{' '}
                  {student.siblingGroup.students.map((s) => s.name).join(', ')}
                </p>
              </div>
            )}
        </div>
      </div>
    </Card>
  )
}
