/**
 * Family Status Badge Component
 * Reusable status badge for consistent display across components
 */

'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { FamilyStatus } from '../../_types'
import { getStatusBadgeConfig } from '../../_utils/status'

interface FamilyStatusBadgeProps {
  status: FamilyStatus
  showLabel?: boolean
  showIcon?: boolean
}

export function FamilyStatusBadge({
  status,
  showLabel = true,
  showIcon = true,
}: FamilyStatusBadgeProps) {
  const config = getStatusBadgeConfig(status)
  const Icon = config.icon

  const badge = (
    <Badge className={config.className}>
      {showIcon && (
        <Icon className={showLabel ? 'mr-1 h-3 w-3' : 'h-3.5 w-3.5'} />
      )}
      {showLabel && config.label}
    </Badge>
  )

  // Wrap in tooltip when icon-only
  if (!showLabel && showIcon) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex">{badge}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return badge
}
