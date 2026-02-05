'use client'

import { useEffect, useState, useTransition } from 'react'

import { ChevronDown, Clock, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { cn } from '@/lib/utils'

import {
  CheckinHistoryItem,
  CheckinHistoryResult,
  getTeacherCheckinHistory,
} from '../actions'

interface Props {
  teacherId: string | null
}

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

function formatTime(date: Date): string {
  return timeFormatter.format(new Date(date))
}

function formatDate(date: Date): string {
  return dateFormatter.format(new Date(date))
}

export function CheckinHistory({ teacherId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [history, setHistory] = useState<CheckinHistoryResult | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    setHistory(null)
    setHasLoaded(false)
    setIsOpen(false)
  }, [teacherId])

  function loadHistory() {
    if (!teacherId || hasLoaded) return
    startTransition(async () => {
      const result = await getTeacherCheckinHistory()
      if (result.success && result.data) {
        setHistory(result.data)
      }
      setHasLoaded(true)
    })
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (open && !hasLoaded) {
      loadHistory()
    }
  }

  if (!teacherId) return null

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-white p-4 text-left hover:bg-gray-50">
        <div className="flex items-center gap-2">
          <Clock aria-hidden="true" className="h-4 w-4 text-[#007078]" />
          <span className="text-sm font-medium">My Recent Check-ins</span>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-4 w-4 text-gray-500 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="rounded-lg border bg-white">
          {isPending && !history ? (
            <div className="flex items-center justify-center py-6">
              <Loader2
                aria-hidden="true"
                className="h-5 w-5 animate-spin text-muted-foreground"
              />
            </div>
          ) : !history || history.data.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No check-ins in the last 30 days
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {history.data.map((item: CheckinHistoryItem) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {formatDate(item.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(item.clockInTime)}
                        {item.clockOutTime &&
                          ` - ${formatTime(item.clockOutTime)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.isLate && (
                      <Badge
                        variant="outline"
                        className="border-orange-200 bg-orange-100 text-xs text-orange-800"
                      >
                        Late
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        SHIFT_BADGES[item.shift].className
                      )}
                    >
                      {SHIFT_BADGES[item.shift].label}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
