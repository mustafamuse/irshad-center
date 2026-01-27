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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, isValidDate } from '@/lib/utils'

interface ClassOption {
  id: string
  name: string
  shift: string
}

interface FilterControlsProps {
  classes: ClassOption[]
}

export function FilterControls({ classes }: FilterControlsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const classId = searchParams.get('classId') || ''
  const fromDate = searchParams.get('fromDate') || ''
  const toDate = searchParams.get('toDate') || ''

  const updateSearchParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/admin/dugsi/attendance?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push('/admin/dugsi/attendance')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filter Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="class-select">
              Class
            </label>
            <Select
              value={classId || 'all'}
              onValueChange={(value) => updateSearchParams('classId', value)}
            >
              <SelectTrigger id="class-select">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.shift})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

        {(classId || fromDate || toDate) && (
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
