/**
 * Child Information Card Component
 *
 * Displays individual child information including name, gender, age,
 * shift, and health information.
 *
 * Used in both family card expansion and family detail sheet.
 */

import React from 'react'

import { AlertCircle } from 'lucide-react'

import { GenderDisplay } from '@/components/ui/gender-display'

import { DugsiRegistration } from '../../_types'
import { ShiftBadge } from '../shared/shift-badge'

function calculateAge(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null
  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

interface ChildInfoCardProps {
  child: DugsiRegistration
  index: number
  editButton?: React.ReactNode
}

export function ChildInfoCard({
  child,
  index,
  editButton,
}: ChildInfoCardProps) {
  const age = calculateAge(child.dateOfBirth)

  return (
    <div
      className="flex items-start gap-3 rounded-lg bg-muted/30 p-3"
      role="listitem"
      aria-label={`Child ${index + 1}: ${child.name}`}
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {index + 1}
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{child.name}</span>
            {child.gender && (
              <GenderDisplay gender={child.gender} size="sm" showLabel />
            )}
          </div>
          {editButton}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {age !== null && <span className="font-medium">{age} years old</span>}
          <ShiftBadge shift={child.shift} />
        </div>
        {child.healthInfo && child.healthInfo.toLowerCase() !== 'none' && (
          <div className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
            <span className="text-xs text-red-600">{child.healthInfo}</span>
          </div>
        )}
      </div>
    </div>
  )
}
