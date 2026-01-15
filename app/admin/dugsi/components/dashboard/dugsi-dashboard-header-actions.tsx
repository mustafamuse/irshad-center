'use client'

import { useState } from 'react'

import { Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { downloadVCardFile } from '@/lib/vcard-client'

import { generateDugsiVCardContent } from '../../actions'

/**
 * DugsiDashboardHeaderActions - Action buttons for Dugsi dashboard header
 *
 * Extracted from DashboardHeader to allow reuse with shared DashboardHeader component
 */
export function DugsiDashboardHeaderActions() {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportContacts = async () => {
    setIsExporting(true)
    try {
      const result = await generateDugsiVCardContent()
      if (!result.success || !result.data) {
        toast.error(result.error || 'Failed to generate contacts')
        return
      }

      const { content, filename, exported, skipped } = result.data
      if (exported === 0) {
        toast.error('No parent contacts with phone or email to export')
        return
      }

      const downloaded = downloadVCardFile(content, filename)
      if (!downloaded) {
        toast.error('Failed to download file')
        return
      }

      const msg =
        skipped > 0
          ? `Exported ${exported} parent contacts (${skipped} skipped)`
          : `Exported ${exported} parent contacts`
      toast.success(msg)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExportContacts}
      disabled={isExporting}
      aria-label="Export parent contacts to vCard"
      className="w-full sm:w-auto"
    >
      <Download className="mr-2 h-4 w-4" />
      {isExporting ? 'Exporting...' : 'Export Contacts'}
    </Button>
  )
}
