'use client'

import { Button } from '@/components/ui/button'

import { useLegacyActions, useViewMode } from '../../store'

interface DashboardHeaderProps {
  title?: string
  description?: string
}

export function DashboardHeader({
  title = 'Dugsi Program Management',
  description = 'Manage student registrations and family subscriptions',
}: DashboardHeaderProps) {
  const viewMode = useViewMode()
  const { setViewMode } = useLegacyActions()

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>

      <div className="flex gap-2" role="group" aria-label="View mode">
        <Button
          variant={viewMode === 'grid' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('grid')}
          aria-pressed={viewMode === 'grid'}
          aria-label="Grid view"
        >
          Grid View
        </Button>
        <Button
          variant={viewMode === 'table' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('table')}
          aria-pressed={viewMode === 'table'}
          aria-label="Table view"
        >
          Table View
        </Button>
      </div>
    </div>
  )
}
