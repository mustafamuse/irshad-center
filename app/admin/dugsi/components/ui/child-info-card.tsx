/**
 * Child Information Card Component
 *
 * Displays individual child information including name, gender, grade,
 * education level, school, and health information.
 *
 * Used in both family card expansion and family detail sheet.
 */

import { AlertCircle } from 'lucide-react'

import { GenderDisplay } from '@/components/ui/gender-display'
import {
  formatEducationLevel,
  formatGradeLevel,
} from '@/lib/utils/enum-formatters'

import { DugsiRegistration } from '../../_types'

interface ChildInfoCardProps {
  child: DugsiRegistration
  index: number
  showSchool?: boolean
}

export function ChildInfoCard({
  child,
  index,
  showSchool = true,
}: ChildInfoCardProps) {
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
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{child.name}</span>
          {child.gender && (
            <GenderDisplay gender={child.gender} size="sm" showLabel />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {child.gradeLevel && (
            <span className="font-medium">
              {formatGradeLevel(child.gradeLevel)}
            </span>
          )}
          {child.educationLevel && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{formatEducationLevel(child.educationLevel)}</span>
            </>
          )}
        </div>
        {showSchool && child.schoolName && (
          <div className="text-xs text-muted-foreground">
            {child.schoolName}
          </div>
        )}
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
