'use client'

import { useEffect, useRef, useState } from 'react'

import { ChevronDown, Clock, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { ATTENDANCE_STATUS_CONFIG } from '@/lib/constants/attendance-status'
import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { AttendanceFetchError } from '@/lib/features/attendance/client'
import {
  useGetSessionMutation,
  useTeacherCheckinHistoryQuery,
} from '@/lib/features/attendance/hooks/teacher'
import { cn } from '@/lib/utils'
import { formatWeekendDate } from '@/lib/utils/format-date'

import { ExcuseForm } from './excuse-form'

interface CheckinHistoryProps {
  teacherId: string | null
  sessionToken: string | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  phase2Enabled: boolean
}

export function CheckinHistory({
  teacherId,
  sessionToken,
  isOpen,
  onOpenChange,
  phase2Enabled,
}: CheckinHistoryProps) {
  const [excuseOpenId, setExcuseOpenId] = useState<string | null>(null)
  const [localToken, setLocalToken] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  const sessionMutation = useGetSessionMutation()

  // Always reflects the current teacherId — updated synchronously on every render.
  // Used in the stale-response guard to detect if teacher changed mid-flight.
  const currentTeacherRef = useRef(teacherId)
  currentTeacherRef.current = teacherId

  useEffect(() => {
    setLocalToken(null)
    setPinError(null)
    setPin('')
  }, [teacherId])

  const effectiveToken = localToken ?? sessionToken

  function handlePinSubmit() {
    if (!teacherId) return
    const submittedFor = teacherId
    sessionMutation.mutate(
      { teacherId, pin },
      {
        onSuccess: (result) => {
          if (currentTeacherRef.current !== submittedFor) return
          setLocalToken(result.token)
          setPin('')
          setPinError(null)
        },
        onError: (err) => {
          if (currentTeacherRef.current !== submittedFor) return
          setPinError(
            err instanceof AttendanceFetchError
              ? err.message
              : 'Failed to verify PIN'
          )
        },
      }
    )
  }

  const historyQuery = useTeacherCheckinHistoryQuery({
    teacherId,
    sessionToken: effectiveToken,
    enabled: isOpen,
    phase2Enabled,
  })

  // Recover from an expired session: a 401 from the history query means the
  // 30-minute HMAC token is no longer valid. Clear the local token so the PIN
  // prompt reappears — the teacher can re-authenticate without a page reload.
  useEffect(() => {
    if (
      localToken &&
      historyQuery.error instanceof AttendanceFetchError &&
      historyQuery.error.status === 401
    ) {
      setLocalToken(null)
      setPin('')
      setExcuseOpenId(null)
      setPinError('Session expired. Enter the PIN again.')
    }
  }, [historyQuery.error, localToken])

  const history = historyQuery.data
  const isPending = historyQuery.isLoading || historyQuery.isFetching
  const error = historyQuery.error?.message ?? null

  if (!teacherId) return null

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-white p-4 text-left hover:bg-gray-50">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#007078]" />
          <span className="text-sm font-medium">My Attendance History</span>
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
          {phase2Enabled && !effectiveToken ? (
            <div className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                Enter the school PIN to view your attendance history.
              </p>
              <Input
                type="password"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pin && !sessionMutation.isPending) {
                    handlePinSubmit()
                  }
                }}
                disabled={sessionMutation.isPending}
              />
              {pinError && (
                <p className="text-xs text-red-600" role="alert">
                  {pinError}
                </p>
              )}
              <Button
                size="sm"
                onClick={handlePinSubmit}
                disabled={!pin || sessionMutation.isPending}
                className="w-full"
              >
                {sessionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Verify PIN'
                )}
              </Button>
            </div>
          ) : isPending && !history ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-6 text-center" role="alert">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : !history || history.records.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No attendance records yet
              </p>
            </div>
          ) : (
            <div>
              <div className="border-b px-4 py-2">
                <p className="text-xs text-muted-foreground">
                  Excused records this month:{' '}
                  <span className="font-semibold text-foreground">
                    {history.monthlyExcuseCount}
                  </span>
                </p>
              </div>

              <div className="divide-y">
                {history.records.map((item) => {
                  const badgeConfig = ATTENDANCE_STATUS_CONFIG[item.status]
                  const canRequestExcuse =
                    (item.status === 'LATE' || item.status === 'ABSENT') &&
                    !item.pendingExcuseId
                  const hasPendingExcuse = !!item.pendingExcuseId
                  const wasRejected = item.wasExcuseRejected
                  const isExcuseOpen = excuseOpenId === item.id

                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {formatWeekendDate(item.date)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.shift === 'MORNING' ? 'Morning' : 'Afternoon'}
                            {item.clockInTime && (
                              <>
                                {' '}
                                · clocked in{' '}
                                {new Date(item.clockInTime).toLocaleTimeString(
                                  'en-US',
                                  {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    timeZone: SCHOOL_TIMEZONE,
                                  }
                                )}
                              </>
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

                      {hasPendingExcuse && (
                        <p className="mt-1 text-xs text-blue-600">
                          Excuse pending review
                        </p>
                      )}

                      {wasRejected && !hasPendingExcuse && !isExcuseOpen && (
                        <p className="mt-1 text-xs text-amber-700">
                          Previous excuse rejected
                        </p>
                      )}

                      {canRequestExcuse && !isExcuseOpen && (
                        <button
                          type="button"
                          className="mt-1 text-xs text-[#007078] underline-offset-2 hover:underline"
                          onClick={() => setExcuseOpenId(item.id)}
                        >
                          {wasRejected ? 'Resubmit excuse' : 'Request excuse'}
                        </button>
                      )}

                      {isExcuseOpen && (
                        <ExcuseForm
                          attendanceRecordId={item.id}
                          teacherId={teacherId}
                          sessionToken={effectiveToken ?? ''}
                          onSuccess={() => setExcuseOpenId(null)}
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
