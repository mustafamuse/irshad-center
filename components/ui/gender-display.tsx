import { Gender } from '@prisma/client'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// SIMPLE GENDER DISPLAY COMPONENT
// ============================================================================

export interface GenderDisplayProps {
  gender: Gender | null
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
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
}: GenderDisplayProps) {
  if (!gender) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const iconSizeClass = SIZE_CLASSES[size]
  const isMale = gender === 'MALE'

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <User
        className={cn(
          iconSizeClass,
          isMale ? 'text-blue-500' : 'text-pink-500'
        )}
      />
      {showLabel && (
        <span
          className={cn('text-xs', isMale ? 'text-blue-600' : 'text-pink-600')}
        >
          {isMale ? 'Boy' : 'Girl'}
        </span>
      )}
    </div>
  )
}

// ============================================================================
// GENDER ICON COMPONENT (for table cells, etc.)
// ============================================================================

export interface GenderIconProps {
  gender: Gender | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function GenderIcon({
  gender,
  size = 'md',
  className,
}: GenderIconProps) {
  if (!gender) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const iconSizeClass = SIZE_CLASSES[size]
  const isMale = gender === 'MALE'

  return (
    <User
      className={cn(
        iconSizeClass,
        isMale ? 'text-blue-500' : 'text-pink-500',
        className
      )}
    />
  )
}
