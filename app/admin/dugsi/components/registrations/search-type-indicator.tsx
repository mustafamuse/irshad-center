/**
 * Search Type Indicator Component
 * Shows contextual hints about the active search type (name, email, or phone)
 */
'use client'

import { Mail, Phone, Users } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SearchTypeIndicatorProps {
  searchQuery: string
  resultCount: number
  className?: string
}

type SearchType = 'email' | 'phone' | 'name'

const ICON_SIZE = 'h-3 w-3'

const SEARCH_TYPE_CONFIG: Record<
  SearchType,
  {
    icon: typeof Mail
    label: string
    ariaLabel: string
  }
> = {
  email: {
    icon: Mail,
    label: 'Searching emails...',
    ariaLabel: 'Searching by email address',
  },
  phone: {
    icon: Phone,
    label: 'Searching phones...',
    ariaLabel: 'Searching by phone number',
  },
  name: {
    icon: Users,
    label: 'Searching names...',
    ariaLabel: 'Searching by name',
  },
}

function detectSearchType(query: string): SearchType {
  if (query.includes('@')) {
    return 'email'
  }
  if (query.replace(/\D/g, '').length >= 4) {
    return 'phone'
  }
  return 'name'
}

export function SearchTypeIndicator({
  searchQuery,
  resultCount,
  className,
}: SearchTypeIndicatorProps) {
  if (!searchQuery) {
    return null
  }

  const searchType = detectSearchType(searchQuery)
  const config = SEARCH_TYPE_CONFIG[searchType]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs text-muted-foreground',
        'duration-200 animate-in fade-in slide-in-from-top-1',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={`${config.ariaLabel}. ${resultCount} results found`}
    >
      <Icon className={ICON_SIZE} aria-hidden="true" />
      <span>{config.label}</span>
      <span className="font-medium" aria-label={`${resultCount} results`}>
        {resultCount} {resultCount === 1 ? 'result' : 'results'}
      </span>
    </div>
  )
}
