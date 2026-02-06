'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { ChevronDown, Clock, Loader2 } from 'lucide-react'

import {
  formatCheckinDate,
  formatCheckinTime,
} from '@/app/admin/dugsi/teachers/components/date-utils'
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

export function CheckinHistory({ teacherId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [history, setHistory] = useState<CheckinHistoryResult | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentTeacherRef = useRef(teacherId)

  useEffect(() => {
    currentTeacherRef.current = teacherId
    setHistory(null)
    setHasLoaded(false)
    setIsOpen(false)
    setError(null)
  }, [teacherId])

  const loadHistory = useCallback(() => {
    if (!teacherId || hasLoaded) return
    const requestTeacherId = teacherId
    startTransition(async () => {
      const result = await getTeacherCheckinHistory(requestTeacherId)
      if (currentTeacherRef.current !== requestTeacherId) return
      if (result.success && result.data) {
        setHistory(result.data)
        setError(null)
      } else {
        setError(result.error ?? 'Failed to load history')
      }
      setHasLoaded(true)
    })
  }, [teacherId, hasLoaded])

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
          <Clock className="h-4 w-4 text-[#007078]" />
          <span className="text-sm font-medium">My Recent Check-ins</span>
        </div>
        <ChevronDown
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
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-6 text-center" role="alert">
              <p className="text-sm text-red-600">{error}</p>
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
                        {formatCheckinDate(item.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCheckinTime(item.clockInTime)}
                        {item.clockOutTime
                          ? ` - ${formatCheckinTime(item.clockOutTime)}`
                          : ' (no clock out)'}
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
