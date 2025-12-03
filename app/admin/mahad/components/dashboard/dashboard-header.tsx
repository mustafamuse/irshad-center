'use client'

import { Download, Plus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { exportMahadStudentsToVCard } from '@/lib/vcard-export'

import { MahadStudent } from '../../_types'
import { useMahadUIStore } from '../../store'

interface DashboardHeaderProps {
  students: MahadStudent[]
}

export function DashboardHeader({ students }: DashboardHeaderProps) {
  const openDialogWithData = useMahadUIStore((s) => s.openDialogWithData)

  const handleExportAll = () => {
    const { exported, skipped, downloadFailed } =
      exportMahadStudentsToVCard(students)
    if (downloadFailed) {
      toast.error('Failed to download file')
      return
    }
    if (exported > 0) {
      const msg =
        skipped > 0
          ? `Exported ${exported} contacts (${skipped} skipped)`
          : `Exported ${exported} contacts`
      toast.success(msg)
    } else {
      toast.error('No contacts with phone or email to export')
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
          className="w-full sm:w-auto"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Contacts
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
