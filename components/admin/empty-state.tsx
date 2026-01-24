'use client'

import { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  className?: string
  iconClassName?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  iconClassName,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-24 text-center',
        className
      )}
    >
      <Icon
        className={cn('mb-4 h-12 w-12 text-muted-foreground/50', iconClassName)}
      />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
