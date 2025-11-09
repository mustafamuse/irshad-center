'use client'

import { LucideIcon, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { typography, spacing, gradients } from '@/lib/design-tokens'

export type StatVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  description?: string
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
    label: string
  }
  variant?: StatVariant
  action?: {
    label: string
    onClick: () => void
  }
  sparkline?: number[]
  loading?: boolean
  className?: string
  animate?: boolean
}

// Semantic variant styles aligned with design tokens
const variantStyles: Record<StatVariant, {
  gradient: string
  icon: string
  trend: string
}> = {
  default: {
    gradient: gradients.default,
    icon: 'bg-muted/50 text-muted-foreground',
    trend: 'text-muted-foreground',
  },
  success: {
    gradient: gradients.success,
    icon: 'bg-accent/10 text-accent-foreground',
    trend: 'text-accent-foreground',
  },
  warning: {
    gradient: gradients.warning,
    icon: 'bg-destructive/10 text-destructive',
    trend: 'text-destructive',
  },
  error: {
    gradient: gradients.warning,
    icon: 'bg-destructive/10 text-destructive',
    trend: 'text-destructive',
  },
  info: {
    gradient: gradients.info,
    icon: 'bg-secondary/10 text-secondary-foreground',
    trend: 'text-secondary-foreground',
  },
}

function AnimatedNumber({ value, animate }: { value: number; animate?: boolean }) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value)

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value)
      return
    }

    const duration = 1000
    const steps = 20
    const stepDuration = duration / steps
    const increment = value / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setDisplayValue(value)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.floor(current))
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [value, animate])

  return <span className="tabular-nums">{displayValue.toLocaleString()}</span>
}

function MiniSparkline({ data, variant }: { data: number[]; variant: StatVariant }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 80
  const height = 30

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const styles = variantStyles[variant]

  return (
    <svg width={width} height={height} className="ml-auto">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={cn(styles.trend, 'opacity-50')}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = 'default',
  action,
  sparkline,
  loading = false,
  className,
  animate = true,
}: StatCardProps) {
  const styles = variantStyles[variant]
  const isNumber = typeof value === 'number'

  if (loading) {
    return (
      <Card className={cn('animate-pulse', spacing.card.default, className)}>
        <div className="space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
      </Card>
    )
  }

  const TrendIcon = trend?.direction === 'up' ? TrendingUp :
                     trend?.direction === 'down' ? TrendingDown : Minus

  return (
    <Card
      variant="gradient"
      hover="scale"
      container="stat"
      dataSlot="stat-card"
      className={cn(
        'relative overflow-hidden',
        styles.gradient,
        spacing.card.default,
        className
      )}
    >
      {/* Subtle overlay for depth */}
      <div
        data-slot="overlay"
        className="absolute inset-0 bg-gradient-to-t from-background/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
      />

      <div className="relative space-y-4">
        {/* Header with icon */}
        <div data-slot="header" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-lg p-3 transition-colors', styles.icon)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p data-slot="label" className={typography.label.base}>
                {title}
              </p>
              {description && (
                <p className={typography.label.subtle}>{description}</p>
              )}
            </div>
          </div>
          {sparkline && <MiniSparkline data={sparkline} variant={variant} />}
        </div>

        {/* Value and trend */}
        <div className="space-y-2">
          <p data-slot="display" className={typography.display.base}>
            {isNumber ? (
              <AnimatedNumber value={value} animate={animate} />
            ) : (
              value
            )}
          </p>

          {trend && (
            <Badge
              data-slot="badge"
              data-variant="trend"
              className={cn('gap-1', styles.trend, spacing.badge)}
            >
              <TrendIcon className="h-3 w-3" />
              <span className="font-medium">
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-muted-foreground ml-1">{trend.label}</span>
            </Badge>
          )}
        </div>

        {/* Action button */}
        {action && (
          <Button
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="absolute bottom-4 right-4 opacity-0 hover:opacity-100 transition-opacity"
          >
            {action.label}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
    </Card>
  )
}