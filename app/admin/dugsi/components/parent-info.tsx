/**
 * Parent Info Component
 * Reusable component for displaying parent information
 */

'use client'

import { Mail, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DugsiRegistration } from '../_types'
import { formatParentName, hasSecondParent } from '../_utils/format'

interface ParentInfoProps {
  registration: DugsiRegistration
  showEmail?: boolean
  showPhone?: boolean
  showSecondParentBadge?: boolean
}

export function ParentInfo({
  registration,
  showEmail = true,
  showPhone = true,
  showSecondParentBadge = true,
}: ParentInfoProps) {
  const parentName = formatParentName(
    registration.parentFirstName,
    registration.parentLastName
  )
  const hasSecond = hasSecondParent(registration)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium">{parentName}</span>
        {hasSecond && showSecondParentBadge && (
          <Badge variant="outline" className="text-xs">
            2 Parents
          </Badge>
        )}
      </div>

      {showEmail && registration.parentEmail && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          <span className="truncate">{registration.parentEmail}</span>
        </div>
      )}

      {showPhone && registration.parentPhone && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          <span>{registration.parentPhone}</span>
        </div>
      )}
    </div>
  )
}
