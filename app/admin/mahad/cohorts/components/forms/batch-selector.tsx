'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BatchWithCount } from '@/lib/types/batch'

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
                  No cohorts available
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
                  No other cohorts available
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
