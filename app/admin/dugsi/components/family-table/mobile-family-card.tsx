'use client'

import { Users, ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { Family } from '../../_types'
import { getFamilyStatus } from '../../_utils/family'
import { formatParentName } from '../../_utils/format'
import { FamilyStatusBadge } from '../family-management/family-status-badge'
import { ShiftBadge } from '../shared/shift-badge'

interface MobileFamilyCardProps {
  family: Family
  isSelected: boolean
  onSelect: () => void
  onClick: () => void
}

export function MobileFamilyCard({
  family,
  isSelected,
  onSelect,
  onClick,
}: MobileFamilyCardProps) {
  const firstMember = family.members[0]
  const status = getFamilyStatus(family)

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:bg-muted/50',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect()}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
            aria-label="Select family"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">
                  {formatParentName(
                    firstMember?.parentFirstName,
                    firstMember?.parentLastName
                  )}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="gap-1 whitespace-nowrap px-1.5 text-xs"
                  >
                    <Users className="h-3 w-3 shrink-0" />
                    {family.members.length}{' '}
                    {family.members.length === 1 ? 'kid' : 'kids'}
                  </Badge>
                  <ShiftBadge shift={firstMember?.shift ?? null} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <FamilyStatusBadge status={status} showLabel={false} />
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            {firstMember?.teacherName && (
              <p className="mt-2 text-xs text-muted-foreground">
                Teacher: {firstMember.teacherName}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
