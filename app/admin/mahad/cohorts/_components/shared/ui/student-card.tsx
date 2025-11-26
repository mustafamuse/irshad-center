'use client'

import { SubscriptionStatus } from '@prisma/client'
import { Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { BatchStudentData } from '@/lib/types/batch'
import { StudentStatus, getStudentStatusDisplay } from '@/lib/types/student'
import { cn } from '@/lib/utils'
import { getSubscriptionStatusDisplay } from '@/lib/utils/subscription-status'

import { CopyableText } from './copyable-text'
import { PhoneContact } from './phone-contact'

interface StudentCardProps {
  student: BatchStudentData
  isSelected: boolean
  onToggle: () => void
  selectable: boolean
  compact?: boolean
  onViewDetails?: () => void
}

export function StudentCard({
  student,
  isSelected,
  onToggle,
  selectable,
  compact = false,
  onViewDetails,
}: StudentCardProps) {
  const handleClick = () => {
    if (onViewDetails) {
      onViewDetails()
    } else if (selectable) {
      onToggle()
    }
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    // Prevent link navigation when clicking checkbox
    e.preventDefault()
    e.stopPropagation()
    onToggle()
  }

  return (
    <Card
      className={cn(
        'transition-all',
        selectable && !onViewDetails && 'cursor-pointer hover:bg-accent',
        isSelected && 'border-primary bg-primary/5',
        compact ? 'p-2' : 'p-3'
      )}
      onClick={!onViewDetails && selectable ? handleClick : undefined}
    >
      <div className="flex items-center gap-3">
        {selectable && (
          <div onClick={handleCheckboxClick} className="shrink-0">
            <Checkbox
              checked={isSelected}
              className="shrink-0"
              aria-label={`Select ${student.name}`}
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {onViewDetails ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewDetails()
                  }}
                  className={cn(
                    'truncate text-left font-medium hover:underline focus:underline focus:outline-none',
                    compact ? 'text-sm' : 'text-sm sm:text-base'
                  )}
                  aria-label={`View details for ${student.name}`}
                >
                  {student.name}
                </button>
              ) : (
                <p
                  className={cn(
                    'truncate font-medium',
                    compact ? 'text-sm' : 'text-sm sm:text-base'
                  )}
                >
                  {student.name}
                </p>
              )}

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
                variant={
                  student.status === StudentStatus.ENROLLED ||
                  student.status === StudentStatus.REGISTERED
                    ? 'default'
                    : 'secondary'
                }
                className="text-xs"
              >
                {getStudentStatusDisplay(student.status as StudentStatus)}
              </Badge>

              {student.batch && (
                <Badge variant="outline" className="text-xs">
                  {student.batch.name}
                </Badge>
              )}

              {student.subscription?.status && (
                <Badge
                  variant={
                    student.subscription.status === 'active'
                      ? 'default'
                      : student.subscription.status === 'past_due'
                        ? 'destructive'
                        : 'secondary'
                  }
                  className="text-xs"
                >
                  {getSubscriptionStatusDisplay(
                    student.subscription.status as SubscriptionStatus
                  )}
                </Badge>
              )}
            </div>
          </div>

          {!compact &&
            student.siblingCount !== undefined &&
            student.siblingCount > 0 && (
              <div className="mt-2">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {student.siblingCount}{' '}
                    {student.siblingCount === 1 ? 'sibling' : 'siblings'}
                  </span>
                </p>
              </div>
            )}
        </div>
      </div>
    </Card>
  )
}
