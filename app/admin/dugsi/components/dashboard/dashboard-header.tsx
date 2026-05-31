'use client'

import { useState } from 'react'

import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { handleVCardExport } from '@/lib/vcard-client'

import { generateDugsiVCardContent } from '../../actions'

interface DashboardHeaderProps {
  title?: string
  description?: string
}

export function DashboardHeader({
  title = 'Dugsi Program Management',
  description = 'Manage student registrations and family subscriptions',
}: DashboardHeaderProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportContacts = async () => {
    setIsExporting(true)
    try {
      const result = await generateDugsiVCardContent({})
      handleVCardExport(result, {
        emptyMessage: 'No parent contacts with phone or email to export',
        successMessage: (exported) => `Exported ${exported} parent contacts`,
      })
    } finally {
      setIsExporting(false)
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

      <Button
        variant="outline"
        size="sm"
        onClick={handleExportContacts}
        disabled={isExporting}
        aria-label="Export parent contacts to vCard"
      >
        <Download className="mr-2 h-4 w-4" />
        {isExporting ? 'Exporting...' : 'Export Contacts'}
      </Button>
    </div>
  )
}
