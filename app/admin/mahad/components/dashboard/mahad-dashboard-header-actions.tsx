'use client'

import { useState } from 'react'

import { Download, Plus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { downloadVCardFile } from '@/lib/vcard-client'

import { generateMahadVCardContent } from '../../_actions/vcard-actions'
import { useMahadUIStore } from '../../store'

/**
 * MahadDashboardHeaderActions - Action buttons for Mahad dashboard header
 *
 * Extracted from DashboardHeader to allow reuse with shared DashboardHeader component
 */
export function MahadDashboardHeaderActions() {
  const openDialog = useMahadUIStore((s) => s.openDialog)
  const [isExporting, setIsExporting] = useState(false)

  const handleExportAll = async () => {
    setIsExporting(true)
    try {
      const result = await generateMahadVCardContent()
      if (!result.success || !result.data) {
        toast.error(result.error || 'Failed to generate contacts')
        return
      }

      const { content, filename, exported, skipped } = result.data
      if (exported === 0) {
        toast.error('No contacts with phone or email to export')
        return
      }

      const downloaded = downloadVCardFile(content, filename)
      if (!downloaded) {
        toast.error('Failed to download file')
        return
      }

      const msg =
        skipped > 0
          ? `Exported ${exported} contacts (${skipped} skipped)`
          : `Exported ${exported} contacts`
      toast.success(msg)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={handleExportAll}
        disabled={isExporting}
        className="w-full sm:w-auto"
      >
        <Download className="mr-2 h-4 w-4" />
        {isExporting ? 'Exporting...' : 'Export Contacts'}
      </Button>
      <Button
        variant="outline"
        onClick={() => openDialog('assignStudents', null)}
        className="w-full sm:w-auto"
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Assign Students
      </Button>
      <Button
        onClick={() => openDialog('createBatch', null)}
        className="w-full sm:w-auto"
      >
        <Plus className="mr-2 h-4 w-4" />
        New Batch
      </Button>
    </>
  )
}
