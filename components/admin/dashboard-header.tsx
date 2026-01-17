'use client'

import { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  title: string
  description: string
  actions?: ReactNode
  className?: string
}

export function DashboardHeader({
  title,
  description,
  actions,
  className,
}: DashboardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>

      {actions && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {actions}
        </div>
      )}
    </div>
  )
}
