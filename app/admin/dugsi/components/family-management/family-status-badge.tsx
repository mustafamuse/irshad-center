/**
 * Family Status Badge Component
 * Reusable status badge for consistent display across components
 */

'use client'

import { Badge } from '@/components/ui/badge'

import { FamilyStatus } from '../../_types'
import { getStatusBadgeConfig } from '../../_utils/status'

export function FamilyStatusBadge({ status }: { status: FamilyStatus }) {
  const config = getStatusBadgeConfig(status)
  const Icon = config.icon

  return (
    <Badge className={config.className}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}
