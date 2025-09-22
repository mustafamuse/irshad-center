'use client'

import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { BatchSelector } from './batch-selector'
import { DateSelector } from './date-selector'
import { useStudents } from '../../_hooks/use-attendance-queries'
import { FilterControlsSkeleton } from '../skeletons'

interface FilterControlsProps {
  selectedDate: Date | undefined
  selectedBatchId: string | undefined
  onDateSelect: (date: Date | undefined) => void
  onBatchSelect: (batchId: string) => void
  onProceed: () => void
  className?: string
}

export function FilterControls({
  selectedDate,
  selectedBatchId,
  onDateSelect,
  onBatchSelect,
  onProceed,
  className,
}: FilterControlsProps) {
  const { data: batches, isLoading, error } = useStudents(selectedBatchId)
  const canProceed = selectedDate && selectedBatchId

  if (isLoading) {
    return <FilterControlsSkeleton />
  }

  return (
    <div className={cn('grid gap-6 md:grid-cols-2', className)}>
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
        </CardHeader>
        <CardContent>
          <DateSelector
            selected={selectedDate}
            onSelect={onDateSelect}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BatchSelector
            value={selectedBatchId}
            onValueChange={onBatchSelect}
            batches={batches ?? []}
            isLoading={isLoading}
            error={error}
          />

          <Button className="w-full" onClick={onProceed} disabled={!canProceed}>
            Proceed to Mark Attendance
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
