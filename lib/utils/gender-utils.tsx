import { Gender } from '@prisma/client'
import { User } from 'lucide-react'
import { ReactNode } from 'react'

// ============================================================================
// GENDER CONSTANTS & TYPES
// ============================================================================

export const GENDER_OPTIONS = [
  { value: 'MALE' as const, label: 'Boy' },
  { value: 'FEMALE' as const, label: 'Girl' },
] as const

export type GenderOption = typeof GENDER_OPTIONS[number]

// ============================================================================
// GENDER DISPLAY UTILITIES
// ============================================================================

export interface GenderDisplayConfig {
  iconSize?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const ICON_SIZES = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4', 
  lg: 'h-5 w-5',
} as const

const LABEL_COLORS = {
  MALE: 'text-blue-600',
  FEMALE: 'text-pink-600',
} as const

const ICON_COLORS = {
  MALE: 'text-blue-500',
  FEMALE: 'text-pink-500',
} as const

/**
 * Get gender display information
 */
export function getGenderDisplay(gender: Gender | string | null): {
  label: string
  iconColor: string
  labelColor: string
} | null {
  if (!gender) return null
  
  switch (gender) {
    case 'MALE':
      return {
        label: 'Boy',
        iconColor: ICON_COLORS.MALE,
        labelColor: LABEL_COLORS.MALE,
      }
    case 'FEMALE':
      return {
        label: 'Girl',
        iconColor: ICON_COLORS.FEMALE,
        labelColor: LABEL_COLORS.FEMALE,
      }
    default:
      return null
  }
}

/**
 * Format gender for display with consistent styling
 */
export function formatGenderDisplay(
  gender: Gender | string | null,
  config: GenderDisplayConfig = {}
): ReactNode {
  const { iconSize = 'md', showLabel = true, className = '' } = config
  const display = getGenderDisplay(gender)
  
  if (!display) return null
  
  const iconSizeClass = ICON_SIZES[iconSize]
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <User className={`${iconSizeClass} ${display.iconColor}`} />
      {showLabel && (
        <span className={`text-xs ${display.labelColor}`}>
          {display.label}
        </span>
      )}
    </div>
  )
}

/**
 * Get gender icon only (for table cells, etc.)
 */
export function getGenderIcon(
  gender: Gender | string | null,
  size: 'sm' | 'md' | 'lg' = 'md'
): ReactNode {
  const display = getGenderDisplay(gender)
  
  if (!display) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  
  const iconSizeClass = ICON_SIZES[size]
  
  return (
    <User className={`${iconSizeClass} ${display.iconColor}`} />
  )
}

/**
 * Validate gender value
 */
export function isValidGender(value: unknown): value is Gender {
  return value === 'MALE' || value === 'FEMALE'
}

/**
 * Get gender label without icon
 */
export function getGenderLabel(gender: Gender | string | null): string {
  const display = getGenderDisplay(gender)
  return display?.label || '—'
}
