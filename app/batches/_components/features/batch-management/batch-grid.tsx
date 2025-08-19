'use client'

import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { BatchCard } from './batch-card'
import { CreateBatchDialog } from './create-batch-dialog'
import { useBatchStore } from '../../../_store/batch.store'
import { BatchWithCount } from '../../../_types'

interface BatchGridProps {
  batches: BatchWithCount[]
}

export function BatchGrid({ batches }: BatchGridProps) {
  const { batchesLoading } = useBatchStore()
  const { setCreateBatchDialogOpen } = useBatchStore()

  if (batchesLoading.isLoading) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center text-muted-foreground">
          Loading batches...
        </div>
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            No batches created yet
          </p>
          <CreateBatchDialog>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setCreateBatchDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create your first batch
            </Button>
          </CreateBatchDialog>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {batches.map((batch) => (
        <BatchCard key={batch.id} batch={batch} />
      ))}
    </div>
  )
}
