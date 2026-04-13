'use client'

import { useState } from 'react'

import type { Shift } from '@prisma/client'

import type { GeofenceCheckResult } from '@/app/teacher/checkin/actions'

export type CheckinMessage = {
  type: 'success' | 'error' | 'warning'
  text: string
}

export interface TeacherCheckinControllerState {
  selectedTeacherId: string | null
  selectedShift: Shift | null
  historyOpen: boolean
  message: CheckinMessage | null
  geofenceStatus: GeofenceCheckResult | null
  locationCoords: { latitude: number | null; longitude: number | null }
}

export interface TeacherCheckinControllerActions {
  setSelectedShift: (shift: Shift | null) => void
  setHistoryOpen: (open: boolean) => void
  setMessage: (msg: CheckinMessage | null) => void
  setGeofenceStatus: (status: GeofenceCheckResult | null) => void
  setLocationCoords: (coords: {
    latitude: number | null
    longitude: number | null
  }) => void
  handleTeacherChange: (id: string | null) => void
}

export function useTeacherCheckinController(): TeacherCheckinControllerState &
  TeacherCheckinControllerActions {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(
    null
  )
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [message, setMessage] = useState<CheckinMessage | null>(null)
  const [geofenceStatus, setGeofenceStatus] =
    useState<GeofenceCheckResult | null>(null)
  const [locationCoords, setLocationCoords] = useState<{
    latitude: number | null
    longitude: number | null
  }>({ latitude: null, longitude: null })

  function handleTeacherChange(id: string | null) {
    setSelectedTeacherId(id)
    setSelectedShift(null)
    setMessage(null)
    setGeofenceStatus(null)
    setLocationCoords({ latitude: null, longitude: null })
    setHistoryOpen(false)
  }

  return {
    selectedTeacherId,
    selectedShift,
    historyOpen,
    message,
    geofenceStatus,
    locationCoords,
    setSelectedShift,
    setHistoryOpen,
    setMessage,
    setGeofenceStatus,
    setLocationCoords,
    handleTeacherChange,
  }
}
