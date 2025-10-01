'use client'

import { Loader2 } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

import { useBatches } from '../../hooks/use-batches'
import { useStudents } from '../../hooks/use-students'

export function TransferProgress() {
  const { isAssigning, isTransferring } = useBatches()
  const { isBulkUpdating } = useStudents()

  const isActive = isAssigning || isTransferring || isBulkUpdating

  if (!isActive) {
    return null
  }

  const getStatusText = () => {
    if (isAssigning) return 'Assigning students to batch...'
    if (isTransferring) return 'Transferring students between batches...'
    if (isBulkUpdating) return 'Updating student records...'
    return 'Processing...'
  }

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>

        <Progress value={undefined} className="h-2" />

        <p className="text-xs text-muted-foreground">
          Please wait while we process your request...
        </p>
      </div>
    </Card>
  )
}
