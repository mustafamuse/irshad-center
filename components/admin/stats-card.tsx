'use client'

import { LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  iconClassName?: string
  valueClassName?: string
  topBarClassName?: string
  onClick?: () => void
  className?: string
  highlight?: boolean
}

/**
 * StatsCard - Reusable card component for dashboard metrics
 *
 * Provides consistent styling, spacing, and interaction patterns
 * for displaying key metrics across admin dashboards
 */
export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
  valueClassName,
  topBarClassName,
  onClick,
  className,
  highlight = false,
}: StatsCardProps) {
  const cardClickStyles = onClick
    ? 'cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all'
    : ''

  return (
    <Card
      className={cn(
        'overflow-hidden border-0 shadow-md transition-all hover:shadow-lg',
        highlight && 'ring-2 ring-primary/20',
        cardClickStyles,
        className
      )}
      onClick={onClick}
    >
      {topBarClassName && <div className={cn('h-1', topBarClassName)} />}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            !iconClassName?.includes('bg-') && 'bg-muted',
            iconClassName
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              // Extract text color from iconClassName, or use default
              iconClassName?.match(/text-[\w-]+/)?.[0] ||
                'text-muted-foreground'
            )}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn('text-2xl font-bold tracking-tight', valueClassName)}
        >
          {value}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
