'use client'

import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useBatches } from '../../_hooks/use-batches'
import { BatchWithCount } from '../../_types'

interface BatchSelectorProps {
  mode: 'assign' | 'transfer'
  selectedBatch: string | null
  destinationBatchId: string | null
  onSelectedBatchChange: (batchId: string | null) => void
  onDestinationBatchChange: (batchId: string | null) => void
  batches: BatchWithCount[]
  isLoading: boolean
}

export function BatchSelector({
  mode,
  selectedBatch,
  destinationBatchId,
  onSelectedBatchChange,
  onDestinationBatchChange,
  batches,
  isLoading,
}: BatchSelectorProps) {
  const { refreshBatches } = useBatches()

  const availableBatches = batches
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  const destinationBatches = batches
    .filter((b) => b.id !== selectedBatch)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-4">
      {/* Source Batch Selection */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">
            {mode === 'assign' ? 'Target Batch' : 'Source Batch'}
          </label>
          <Select
            value={selectedBatch || ''}
            onValueChange={onSelectedBatchChange}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={`Select ${mode === 'assign' ? 'target' : 'source'} batch...`}
              />
            </SelectTrigger>
            <SelectContent>
              {availableBatches.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No batches available
                </div>
              ) : (
                availableBatches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name} ({batch.studentCount} students)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={refreshBatches}
          disabled={isLoading}
          className="shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Destination Batch Selection (Transfer Mode Only) */}
      {mode === 'transfer' && selectedBatch && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Destination Batch</label>
          <Select
            value={destinationBatchId || ''}
            onValueChange={onDestinationBatchChange}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select destination batch..." />
            </SelectTrigger>
            <SelectContent>
              {destinationBatches.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No other batches available
                </div>
              ) : (
                destinationBatches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name} ({batch.studentCount} students)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
