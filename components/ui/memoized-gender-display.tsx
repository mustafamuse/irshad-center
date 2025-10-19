import { memo } from 'react'
import { Gender } from '@prisma/client'
import { GenderDisplay, GenderIcon } from './gender-display'

// ============================================================================
// MEMOIZED GENDER DISPLAY COMPONENTS
// ============================================================================

export interface MemoizedGenderDisplayProps {
  gender: Gender | string | null
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
  fallback?: React.ReactNode
}

export const MemoizedGenderDisplay = memo<MemoizedGenderDisplayProps>(
  function MemoizedGenderDisplay(props) {
    return <GenderDisplay {...props} />
  }
)

export interface MemoizedGenderIconProps {
  gender: Gender | string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const MemoizedGenderIcon = memo<MemoizedGenderIconProps>(
  function MemoizedGenderIcon(props) {
    return <GenderIcon {...props} />
  }
)
