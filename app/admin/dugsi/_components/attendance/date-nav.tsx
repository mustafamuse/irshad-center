'use client'

import { format } from 'date-fns'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateNavProps {
  date: Date
  onDateChange: (date: Date) => void
  disableFuture?: boolean
}

export function DateNav({
  date,
  onDateChange,
  disableFuture = true,
}: DateNavProps) {
  const isToday =
    format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  const handlePrev = () => {
    const newDate = new Date(date)
    newDate.setDate(newDate.getDate() - 1)
    onDateChange(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(date)
    newDate.setDate(newDate.getDate() + 1)
    onDateChange(newDate)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={handlePrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[180px] justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(date, 'EEE, MMM d, yyyy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && onDateChange(d)}
            disabled={disableFuture ? (d) => d > new Date() : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={disableFuture && isToday}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isToday && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateChange(new Date())}
        >
          Today
        </Button>
      )}
    </div>
  )
}
