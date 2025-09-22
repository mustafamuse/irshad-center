'use client'

import { Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Batch } from '@/app/batches/_types'

interface BatchSelectorProps {
  value: string | undefined
  onValueChange: (value: string) => void
  batches: Batch[]
  isLoading: boolean
  error?: Error | null
}

export function BatchSelector({
  value,
  onValueChange,
  batches,
  isLoading,
  error,
}: BatchSelectorProps) {
  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger disabled={isLoading}>
          <SelectValue
            placeholder={isLoading ? 'Loading batches...' : 'Choose a batch'}
          />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <SelectItem value="loading" disabled>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading batches...
              </div>
            </SelectItem>
          ) : error ? (
            <SelectItem value="error" disabled>
              Failed to load batches
            </SelectItem>
          ) : batches.length === 0 ? (
            <SelectItem value="empty" disabled>
              No batches found
            </SelectItem>
          ) : (
            batches.map((batch) => (
              <SelectItem key={batch.id} value={batch.id}>
                {batch.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {error && (
        <p className="text-sm text-destructive">
          {error.message || 'Failed to load batches'}
        </p>
      )}
    </div>
  )
}
