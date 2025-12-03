'use client'

import { useState } from 'react'

import { Download, Plus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { downloadVCardFile } from '@/lib/vcard-client'

import { generateMahadVCardContent } from '../../_actions/vcard-actions'
import { useMahadUIStore } from '../../store'

export function DashboardHeader() {
  const openDialogWithData = useMahadUIStore((s) => s.openDialogWithData)
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Mahad Cohorts
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Manage students, batches, and enrollment
        </p>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
          onClick={() => openDialogWithData('assignStudents')}
          className="w-full sm:w-auto"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Assign Students
        </Button>
        <Button
          onClick={() => openDialogWithData('createBatch')}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Batch
        </Button>
      </div>
    </div>
  )
}
