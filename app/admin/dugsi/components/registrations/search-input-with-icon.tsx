/**
 * Reusable search input with left-positioned icon
 */
'use client'

import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputWithIconProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  'aria-label'?: string
}

const ICON_SIZE = 'h-4 w-4'
const ICON_POSITION = 'absolute left-3 top-1/2 -translate-y-1/2'
const INPUT_PADDING = 'pl-9' // Matches icon position (left-3 + icon width + spacing)

export function SearchInputWithIcon({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  'aria-label': ariaLabel,
}: SearchInputWithIconProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className={cn(ICON_SIZE, ICON_POSITION, 'text-muted-foreground')}
        aria-hidden="true"
      />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT_PADDING, 'transition-shadow duration-200')}
        aria-label={ariaLabel || placeholder}
      />
    </div>
  )
}
