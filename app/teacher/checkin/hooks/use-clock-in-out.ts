'use client'

import { useRef, useTransition } from 'react'

import { Shift } from '@prisma/client'

import {
  teacherClockInAction,
  teacherClockOutAction,
  type TeacherCurrentStatus,
} from '../actions'

interface UseClockInOutParams {
  teacherId: string
  shift: Shift
  locationCoords: { latitude: number; longitude: number } | null
  currentCheckinId: string | null
  onClockIn: (status: TeacherCurrentStatus, message: string) => void
  onClockOut: (status: TeacherCurrentStatus, message: string) => void
  onError: (msg: string) => void
}

interface UseClockInOutResult {
  isPending: boolean
  handleClockIn: () => void
  handleClockOut: () => void
}

export function useClockInOut({
  teacherId,
  shift,
  locationCoords,
  currentCheckinId,
  onClockIn,
  onClockOut,
  onError,
}: UseClockInOutParams): UseClockInOutResult {
  const [isPending, startTransition] = useTransition()

  // Always reflects the latest teacherId so in-flight responses can detect staleness.
  // Updated synchronously on every render (not in an effect) so the check is reliable
  // even when React batches state updates across teacher switches.
  const currentTeacherRef = useRef(teacherId)
  currentTeacherRef.current = teacherId

  const handleClockIn = () => {
    if (!locationCoords?.latitude || !locationCoords?.longitude) {
      onError('Location is required. Please enable location and try again.')
      return
    }

    const id = teacherId
    const lat = locationCoords.latitude
    const lng = locationCoords.longitude

    startTransition(async () => {
      const result = await teacherClockInAction({
        teacherId: id,
        shift,
        latitude: lat,
        longitude: lng,
      })

      if (currentTeacherRef.current !== id) return
      if (result?.data) {
        onClockIn(result.data.status, result.data.message)
      } else {
        onError(result?.serverError ?? 'Clock-in failed')
      }
    })
  }

  const handleClockOut = () => {
    if (
      !currentCheckinId ||
      !locationCoords?.latitude ||
      !locationCoords?.longitude
    ) {
      onError('Location is required. Please enable location and try again.')
      return
    }

    const id = teacherId
    const lat = locationCoords.latitude
    const lng = locationCoords.longitude

    startTransition(async () => {
      const result = await teacherClockOutAction({
        checkInId: currentCheckinId,
        teacherId: id,
        latitude: lat,
        longitude: lng,
      })

      if (currentTeacherRef.current !== id) return
      if (result?.data) {
        onClockOut(result.data.status, result.data.message)
      } else {
        onError(result?.serverError ?? 'Clock-out failed')
      }
    })
  }

  return { isPending, handleClockIn, handleClockOut }
}
