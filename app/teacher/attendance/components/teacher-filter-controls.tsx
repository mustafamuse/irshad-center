'use client'

import { useRouter, useSearchParams } from 'next/navigation'

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
import { cn, isValidDate } from '@/lib/utils'

export function TeacherFilterControls() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const fromDate = searchParams.get('fromDate') || ''
  const toDate = searchParams.get('toDate') || ''

  const updateSearchParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/teacher/attendance?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push('/teacher/attendance')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filter Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="from-date">
              From Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className={cn(
                    'h-10 min-h-[44px] w-full justify-start text-left font-normal',
                    !fromDate && 'text-muted-foreground'
                  )}
                  id="from-date"
                  variant="outline"
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {fromDate && isValidDate(fromDate)
                    ? format(new Date(fromDate), 'PPP')
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  initialFocus
                  mode="single"
                  selected={
                    fromDate && isValidDate(fromDate)
                      ? new Date(fromDate)
                      : undefined
                  }
                  onSelect={(date) =>
                    updateSearchParams(
                      'fromDate',
                      date ? format(date, 'yyyy-MM-dd') : ''
                    )
                  }
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="to-date">
              To Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className={cn(
                    'h-10 min-h-[44px] w-full justify-start text-left font-normal',
                    !toDate && 'text-muted-foreground'
                  )}
                  id="to-date"
                  variant="outline"
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {toDate && isValidDate(toDate)
                    ? format(new Date(toDate), 'PPP')
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  initialFocus
                  mode="single"
                  selected={
                    toDate && isValidDate(toDate) ? new Date(toDate) : undefined
                  }
                  onSelect={(date) =>
                    updateSearchParams(
                      'toDate',
                      date ? format(date, 'yyyy-MM-dd') : ''
                    )
                  }
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {(fromDate || toDate) && (
          <Button
            className="min-h-[44px] w-full"
            variant="outline"
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
