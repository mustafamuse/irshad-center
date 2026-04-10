'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { ChevronDown, Clock, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { cn } from '@/lib/utils'

import {
  type AttendanceHistoryItem,
  type AttendanceHistoryResult,
  getTeacherAttendanceHistory,
} from '../actions'
import { ExcuseForm } from './excuse-form'

const STATUS_BADGE: Record<
  AttendanceHistoryItem['status'],
  { label: string; className: string }
> = {
  EXPECTED: { label: 'Expected', className: 'border-gray-200 bg-gray-100 text-gray-500' },
  PRESENT: { label: 'Present', className: 'border-green-200 bg-green-100 text-green-800' },
  LATE: { label: 'Late', className: 'border-orange-200 bg-orange-100 text-orange-800' },
  ABSENT: { label: 'Absent', className: 'border-red-200 bg-red-100 text-red-800' },
  EXCUSED: { label: 'Excused', className: 'border-blue-200 bg-blue-100 text-blue-800' },
  CLOSED: { label: 'Closed', className: 'border-slate-200 bg-slate-100 text-slate-400' },
}

function formatDateLabel(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
}

interface Props {
  teacherId: string | null
}

export function CheckinHistory({ teacherId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [history, setHistory] = useState<AttendanceHistoryResult | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [excuseOpenId, setExcuseOpenId] = useState<string | null>(null)
  const currentTeacherRef = useRef(teacherId)

  useEffect(() => {
    currentTeacherRef.current = teacherId
    setHistory(null)
    setHasLoaded(false)
    setIsOpen(false)
    setError(null)
    setExcuseOpenId(null)
  }, [teacherId])

  // Unconditional fetch — used by both the initial load and post-excuse reload.
  // Separated from loadHistory so handleExcuseSuccess doesn't rely on hasLoaded state.
  // Empty deps: startTransition and state setters are stable across renders.
  const fetchHistory = useCallback((id: string) => {
    startTransition(async () => {
      try {
        const result = await getTeacherAttendanceHistory(id)
        if (currentTeacherRef.current !== id) return
        setHistory(result)
        setError(null)
      } catch (err) {
        if (currentTeacherRef.current !== id) return
        setError(err instanceof Error ? err.message : 'Failed to load history')
      }
      setHasLoaded(true)
    })
  }, [])

  const loadHistory = useCallback(() => {
    if (!teacherId || hasLoaded) return
    fetchHistory(teacherId)
  }, [teacherId, hasLoaded, fetchHistory])

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (open && !hasLoaded) loadHistory()
  }

  function handleExcuseSuccess() {
    setExcuseOpenId(null)
    // Bypass the hasLoaded guard — we need a fresh fetch regardless of prior load state
    if (teacherId) fetchHistory(teacherId)
  }

  if (!teacherId) return null

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-white p-4 text-left hover:bg-gray-50">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#007078]" />
          <span className="text-sm font-medium">My Attendance History</span>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 text-gray-500 transition-transform', isOpen && 'rotate-180')}
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
          ) : !history || history.records.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No attendance records yet</p>
            </div>
          ) : (
            <div>
              {/* Monthly excuse count */}
              <div className="border-b px-4 py-2">
                <p className="text-xs text-muted-foreground">
                  Excuses this month:{' '}
                  <span className="font-semibold text-foreground">
                    {history.monthlyExcuseCount}
                  </span>
                </p>
              </div>

              {/* Status rows */}
              <div className="divide-y">
                {history.records.map((item) => {
                  const badgeConfig = STATUS_BADGE[item.status]
                  const canRequestExcuse =
                    (item.status === 'LATE' || item.status === 'ABSENT') &&
                    !item.pendingExcuseId
                  const hasPendingExcuse = !!item.pendingExcuseId
                  const isExcuseOpen = excuseOpenId === item.id

                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{formatDateLabel(item.date)}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.shift === 'MORNING' ? 'Morning' : 'Afternoon'}
                            {item.clockInTime && (
                              <> · clocked in {new Date(item.clockInTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: SCHOOL_TIMEZONE })}</>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.status === 'LATE' && item.minutesLate && (
                            <span className="text-xs text-muted-foreground">
                              +{item.minutesLate}m
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={cn('text-xs', badgeConfig.className)}
                          >
                            {badgeConfig.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Excuse actions */}
                      {hasPendingExcuse && (
                        <p className="mt-1 text-xs text-blue-600">Excuse pending review</p>
                      )}

                      {canRequestExcuse && !isExcuseOpen && (
                        <button
                          className="mt-1 text-xs text-[#007078] underline-offset-2 hover:underline"
                          onClick={() => setExcuseOpenId(item.id)}
                        >
                          Request excuse
                        </button>
                      )}

                      {isExcuseOpen && (
                        <ExcuseForm
                          attendanceRecordId={item.id}
                          onSuccess={handleExcuseSuccess}
                          onCancel={() => setExcuseOpenId(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
