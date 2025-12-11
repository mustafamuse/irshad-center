import { Program, EnrollmentStatus } from '@prisma/client'

import { Badge } from '@/components/ui/badge'
import {
  PROGRAM_LABELS,
  PROGRAM_BADGE_COLORS,
} from '@/lib/constants/program-ui'

interface ProgramBadgeProps {
  program: Program
  status?: EnrollmentStatus
  size?: 'sm' | 'default'
}

export function ProgramBadge({
  program,
  status,
  size = 'default',
}: ProgramBadgeProps) {
  const variant =
    status && status !== 'ENROLLED'
      ? 'secondary'
      : PROGRAM_BADGE_COLORS[program]

  return (
    <Badge variant={variant} className={size === 'sm' ? 'text-xs' : undefined}>
      {PROGRAM_LABELS[program]}
    </Badge>
  )
}

interface ProgramBadgesProps {
  programs: Program[]
  statusMap?: Record<string, EnrollmentStatus>
  size?: 'sm' | 'default'
}

export function ProgramBadges({
  programs,
  statusMap,
  size = 'default',
}: ProgramBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {programs.map((program) => (
        <ProgramBadge
          key={program}
          program={program}
          status={statusMap?.[program]}
          size={size}
        />
      ))}
    </div>
  )
}
