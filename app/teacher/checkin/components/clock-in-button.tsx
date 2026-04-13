'use client'

import { useTransition } from 'react'

import { Shift } from '@prisma/client'
import { format } from 'date-fns'
import { CheckCircle2, Loader2, LogIn, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'

import {
  teacherClockInAction,
  teacherClockOutAction,
  type GeofenceCheckResult,
  type TeacherCurrentStatus,
} from '../actions'

interface ClockInButtonProps {
  teacherId: string
  shift: Shift
  geofenceStatus: GeofenceCheckResult | null
  locationCoords: { latitude: number; longitude: number } | null
  currentCheckin: {
    id: string
    clockInTime: Date | null
    clockOutTime: Date | null
  } | null
  isPending: boolean
  onClockIn: (status: TeacherCurrentStatus, message: string) => void
  onClockOut: (status: TeacherCurrentStatus, message: string) => void
  onError: (msg: string) => void
}

function formatTime(date: Date | null): string | null {
  if (!date) return null
  return format(new Date(date), 'h:mm a')
}

export function ClockInButton({
  teacherId,
  shift,
  geofenceStatus,
  locationCoords,
  currentCheckin,
  isPending: externalPending,
  onClockIn,
  onClockOut,
  onError,
}: ClockInButtonProps) {
  const [isPending, startTransition] = useTransition()

  const isClockedIn = currentCheckin !== null
  const isClockedOut = isClockedIn && currentCheckin.clockOutTime !== null
  const isAnyPending = isPending || externalPending

  const handleClockIn = () => {
    if (!locationCoords?.latitude || !locationCoords?.longitude) {
      onError('Location is required. Please enable location and try again.')
      return
    }

    const lat = locationCoords.latitude
    const lng = locationCoords.longitude

    startTransition(async () => {
      const result = await teacherClockInAction({
        teacherId,
        shift,
        latitude: lat,
        longitude: lng,
      })

      if (result?.data) {
        onClockIn(result.data.status, result.data.message)
      } else {
        onError(result?.serverError ?? 'Clock-in failed')
      }
    })
  }

  const handleClockOut = () => {
    if (
      !currentCheckin?.id ||
      !locationCoords?.latitude ||
      !locationCoords?.longitude
    ) {
      onError('Location is required. Please enable location and try again.')
      return
    }

    const lat = locationCoords.latitude
    const lng = locationCoords.longitude

    startTransition(async () => {
      const result = await teacherClockOutAction({
        checkInId: currentCheckin.id,
        teacherId,
        latitude: lat,
        longitude: lng,
      })

      if (result?.data) {
        onClockOut(result.data.status, result.data.message)
      } else {
        onError(result?.serverError ?? 'Clock-out failed')
      }
    })
  }

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
        onClick={handleClockOut}
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
      onClick={handleClockIn}
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
