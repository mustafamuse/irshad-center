'use client'

import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  onClick?: () => void
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1 text-sm', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={index} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {item.onClick && !isLast ? (
              <button
                onClick={item.onClick}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </button>
            ) : (
              <span
                className={cn(
                  isLast
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
