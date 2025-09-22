'use client'

import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateSelectorProps {
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
  className?: string
}

export function DateSelector({
  selected,
  onSelect,
  className,
}: DateSelectorProps) {
  const today = new Date()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onSelect(today)}>
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            onSelect(yesterday)
          }}
        >
          Yesterday
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)
            onSelect(tomorrow)
          }}
        >
          Tomorrow
        </Button>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !selected && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected ? format(selected, 'PPP') : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={onSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
