'use client'

import { Shift } from '@prisma/client'
import { format } from 'date-fns'
import { CheckCircle2, Loader2, LogIn, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { AttendanceFetchError } from '@/lib/features/attendance/client'
import {
  useClockInMutation,
  useClockOutMutation,
} from '@/lib/features/attendance/hooks/teacher'

import type { GeofenceCheckResult } from '../actions'

interface ClockInButtonProps {
  teacherId: string
  shift: Shift
  geofenceStatus: GeofenceCheckResult | null
  locationCoords: { latitude: number; longitude: number } | null
  currentCheckin: {
    id: string
    clockInTime: string | null
    clockOutTime: string | null
  } | null
  isContextLoading: boolean
  onClockIn: (message: string) => void
  onClockOut: (message: string) => void
  onError: (msg: string) => void
}

function formatTime(date: string | null): string | null {
  if (!date) return null
  return format(new Date(date), 'h:mm a')
}

export function ClockInButton({
  teacherId,
  shift,
  geofenceStatus,
  locationCoords,
  currentCheckin,
  isContextLoading,
  onClockIn,
  onClockOut,
  onError,
}: ClockInButtonProps) {
  const clockInMutation = useClockInMutation(teacherId)
  const clockOutMutation = useClockOutMutation(teacherId)

  const isPending = clockInMutation.isPending || clockOutMutation.isPending
  const isAnyPending = isPending || isContextLoading

  function extractErrorMessage(error: unknown): string {
    if (error instanceof AttendanceFetchError) return error.message
    if (error instanceof Error) return error.message
    return 'Something went wrong. Please try again.'
  }

  async function handleClockIn() {
    if (!locationCoords?.latitude || !locationCoords?.longitude) {
      onError('Location is required. Please enable location and try again.')
      return
    }
    try {
      const result = await clockInMutation.mutateAsync({
        shift,
        latitude: locationCoords.latitude,
        longitude: locationCoords.longitude,
      })
      onClockIn(result.message)
    } catch (error) {
      onError(extractErrorMessage(error))
    }
  }

  async function handleClockOut() {
    if (
      !currentCheckin?.id ||
      !locationCoords?.latitude ||
      !locationCoords?.longitude
    ) {
      onError('Location is required. Please enable location and try again.')
      return
    }
    try {
      const result = await clockOutMutation.mutateAsync({
        checkInId: currentCheckin.id,
        latitude: locationCoords.latitude,
        longitude: locationCoords.longitude,
      })
      onClockOut(result.message)
    } catch (error) {
      onError(extractErrorMessage(error))
    }
  }

  const isClockedIn = currentCheckin !== null
  const isClockedOut = isClockedIn && currentCheckin.clockOutTime !== null

  if (isClockedOut) {
    return (
      <div className="rounded-xl border-2 border-dashed border-green-200 bg-green-50/50 p-4 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        </div>
        <p className="font-medium text-green-800">Shift Complete</p>
        <p className="mt-1 text-sm text-green-600">
          You have completed your {shift.toLowerCase()} shift.
        </p>
        <p className="mt-1 text-xs text-green-500">
          {formatTime(currentCheckin.clockInTime)} –{' '}
          {formatTime(currentCheckin.clockOutTime)}
        </p>
      </div>
    )
  }

  if (isClockedIn) {
    return (
      <Button
        size="lg"
        className="h-14 w-full bg-amber-600 text-lg text-white shadow-lg shadow-amber-600/25 transition-[background-color,box-shadow,transform] hover:bg-amber-700 hover:shadow-xl hover:shadow-amber-600/30 active:scale-[0.98]"
        onClick={() => void handleClockOut()}
        disabled={!locationCoords?.latitude || isAnyPending}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <LogOut className="mr-2 h-5 w-5" />
        )}
        Clock Out
      </Button>
    )
  }

  return (
    <Button
      size="lg"
      className="h-14 w-full bg-[#007078] text-lg shadow-lg shadow-[#007078]/25 transition-[background-color,box-shadow,transform] hover:bg-[#005a61] hover:shadow-xl hover:shadow-[#007078]/30 hover:ring-2 hover:ring-[#deb43e]/50 hover:ring-offset-1 active:scale-[0.98]"
      onClick={() => void handleClockIn()}
      disabled={
        !locationCoords?.latitude ||
        isAnyPending ||
        geofenceStatus?.isWithinGeofence !== true
      }
    >
      {isPending ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        <LogIn className="mr-2 h-5 w-5" />
      )}
      Clock In
    </Button>
  )
}
