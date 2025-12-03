'use client'

import { Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { exportDugsiParentsToVCard } from '@/lib/vcard-export'

import { Family } from '../../_types'
import { useLegacyActions, useViewMode } from '../../store'

interface DashboardHeaderProps {
  title?: string
  description?: string
  families?: Family[]
}

export function DashboardHeader({
  title = 'Dugsi Program Management',
  description = 'Manage student registrations and family subscriptions',
  families = [],
}: DashboardHeaderProps) {
  const viewMode = useViewMode()
  const { setViewMode } = useLegacyActions()

  const handleExportContacts = () => {
    if (families.length === 0) {
      toast.error('No families to export')
      return
    }
    const { exported, skipped, downloadFailed } =
      exportDugsiParentsToVCard(families)
    if (downloadFailed) {
      toast.error('Failed to download file')
      return
    }
    if (exported > 0) {
      const msg =
        skipped > 0
          ? `Exported ${exported} parent contacts (${skipped} skipped)`
          : `Exported ${exported} parent contacts`
      toast.success(msg)
    } else {
      toast.error('No parent contacts with phone or email to export')
    }
  }

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

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportContacts}
          aria-label="Export parent contacts to vCard"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Contacts
        </Button>
        <div className="flex gap-2" role="group" aria-label="View mode">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            aria-label="Parents view"
          >
            Parents
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            aria-pressed={viewMode === 'table'}
            aria-label="Students view"
          >
            Students
          </Button>
        </div>
      </div>
    </div>
  )
}
