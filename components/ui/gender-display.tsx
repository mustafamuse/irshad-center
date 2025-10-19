import { Gender } from '@prisma/client'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getGenderDisplay } from '@/lib/utils/gender-utils'

// ============================================================================
// GENDER DISPLAY COMPONENT
// ============================================================================

export interface GenderDisplayProps {
  gender: Gender | string | null
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
  fallback?: React.ReactNode
}

const SIZE_CLASSES = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
} as const

export function GenderDisplay({
  gender,
  size = 'md',
  showLabel = true,
  className,
  fallback = <span className="text-xs text-muted-foreground">—</span>,
}: GenderDisplayProps) {
  const display = getGenderDisplay(gender)
  
  if (!display) {
    return <>{fallback}</>
  }
  
  const iconSizeClass = SIZE_CLASSES[size]
  
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <User className={cn(iconSizeClass, display.iconColor)} />
      {showLabel && (
        <span className={cn('text-xs', display.labelColor)}>
          {display.label}
        </span>
      )}
    </div>
  )
}

// ============================================================================
// GENDER ICON COMPONENT (for table cells, etc.)
// ============================================================================

export interface GenderIconProps {
  gender: Gender | string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function GenderIcon({ gender, size = 'md', className }: GenderIconProps) {
  const display = getGenderDisplay(gender)
  
  if (!display) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  
  const iconSizeClass = SIZE_CLASSES[size]
  
  return (
    <User className={cn(iconSizeClass, display.iconColor, className)} />
  )
}
