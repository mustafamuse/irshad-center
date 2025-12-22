'use client'

import { useState, useEffect, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { format } from 'date-fns'
import {
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DUGSI_CENTER_COORDINATES,
  GEOFENCE_RADIUS_METERS,
} from '@/lib/constants/dugsi'
import type { DugsiTeacherDTO } from '@/lib/db/queries/teacher'
import type { CheckInWindowStatus } from '@/lib/services/dugsi/teacher-checkin-service'
import type { TeacherCheckInDTO } from '@/lib/types/dugsi-attendance'

import {
  clockInAction,
  clockOutAction,
  getCheckInWindowStatusAction,
  getTodaysCheckInsAction,
  getTeacherShiftsAction,
} from './actions'

function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface TeacherCheckInProps {
  teachers: DugsiTeacherDTO[]
}

type LocationState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  lat?: number
  lng?: number
  error?: string
}

export function TeacherCheckIn({ teachers }: TeacherCheckInProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [selectedShift, setSelectedShift] = useState<Shift | ''>('')
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(false)
  const [todaysCheckIns, setTodaysCheckIns] = useState<TeacherCheckInDTO[]>([])
  const [location, setLocation] = useState<LocationState>({ status: 'idle' })
  const [windowStatus, setWindowStatus] = useState<CheckInWindowStatus | null>(
    null
  )

  useEffect(() => {
    if (selectedTeacherId) {
      setShiftsLoading(true)
      loadTeacherData().finally(() => setShiftsLoading(false))
    } else {
      setAvailableShifts([])
      setTodaysCheckIns([])
      setSelectedShift('')
      setWindowStatus(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacherId])

  useEffect(() => {
    if (selectedShift) {
      getCheckInWindowStatusAction(selectedShift).then((result) => {
        if (result.success && result.data) {
          setWindowStatus(result.data)
        }
      })
    } else {
      setWindowStatus(null)
    }
  }, [selectedShift])

  const loadTeacherData = async () => {
    if (!selectedTeacherId) return

    const [shiftsResult, checkInsResult] = await Promise.all([
      getTeacherShiftsAction(selectedTeacherId),
      getTodaysCheckInsAction(selectedTeacherId),
    ])

    if (shiftsResult.success && shiftsResult.data) {
      setAvailableShifts(shiftsResult.data)
      if (shiftsResult.data.length === 1) {
        setSelectedShift(shiftsResult.data[0])
      }
    }

    if (checkInsResult.success && checkInsResult.data) {
      setTodaysCheckIns(checkInsResult.data)
    }
  }

  const requestLocation = () => {
    setLocation({ status: 'loading' })

    if (!navigator.geolocation) {
      setLocation({ status: 'error', error: 'Geolocation not supported' })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          status: 'success',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        setLocation({
          status: 'error',
          error: error.message || 'Failed to get location',
        })
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleClockIn = async () => {
    if (!selectedTeacherId || !selectedShift || location.status !== 'success')
      return

    startTransition(async () => {
      const result = await clockInAction({
        teacherId: selectedTeacherId,
        shift: selectedShift,
        lat: location.lat!,
        lng: location.lng!,
      })

      if (result.success && result.data) {
        const messages: string[] = ['Clocked in successfully']
        if (result.data.isLate) {
          messages.push('(marked as late)')
        }
        toast.success(messages.join(' '))
        loadTeacherData()
      } else {
        toast.error(result.error || 'Failed to clock in')
      }
    })
  }

  const handleClockOut = async (checkInId: string) => {
    startTransition(async () => {
      const result = await clockOutAction({
        checkInId,
        lat: location.lat,
        lng: location.lng,
      })

      if (result.success) {
        toast.success('Clocked out successfully')
        loadTeacherData()
      } else {
        toast.error(result.error || 'Failed to clock out')
      }
    })
  }

  const currentShiftCheckIn = todaysCheckIns.find(
    (c) => c.shift === selectedShift
  )
  const isWithinGeofence =
    location.status === 'success' &&
    getDistanceMeters(
      location.lat!,
      location.lng!,
      DUGSI_CENTER_COORDINATES.lat,
      DUGSI_CENTER_COORDINATES.lng
    ) <= GEOFENCE_RADIUS_METERS
  const isWindowOpen = windowStatus?.canCheckIn ?? false
  const canClockIn =
    selectedTeacherId &&
    selectedShift &&
    isWithinGeofence &&
    isWindowOpen &&
    !currentShiftCheckIn
  const canClockOut = currentShiftCheckIn && !currentShiftCheckIn.clockOutTime

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Teacher Check-In</h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Select Your Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={selectedTeacherId}
            onValueChange={setSelectedTeacherId}
          >
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Choose your name" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((teacher) => (
                <SelectItem
                  key={teacher.id}
                  value={teacher.id}
                  className="text-base"
                >
                  {teacher.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTeacherId && availableShifts.length > 1 && (
            <Select
              value={selectedShift}
              onValueChange={(v) => setSelectedShift(v as Shift)}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {availableShifts.map((shift) => (
                  <SelectItem key={shift} value={shift} className="text-base">
                    {shift === 'MORNING' ? 'Morning Shift' : 'Afternoon Shift'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedTeacherId &&
            !shiftsLoading &&
            availableShifts.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-yellow-800">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  No shifts assigned. Please contact admin.
                </span>
              </div>
            )}
        </CardContent>
      </Card>

      {selectedTeacherId && availableShifts.length > 0 && selectedShift && (
        <>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Verify Location</CardTitle>
              <CardDescription>
                You must be at the center to check in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-full"
                onClick={requestLocation}
                disabled={location.status === 'loading'}
              >
                <MapPin className="mr-2 h-5 w-5" />
                {location.status === 'loading'
                  ? 'Getting location...'
                  : 'Verify My Location'}
              </Button>

              <LocationStatus
                location={location}
                isWithinGeofence={isWithinGeofence}
              />

              {selectedShift && windowStatus && !windowStatus.canCheckIn && (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-yellow-800">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">
                    {windowStatus.reason === 'too_early'
                      ? `Check-in opens at ${format(new Date(windowStatus.windowOpensAt!), 'h:mm a')}`
                      : 'Check-in window has closed for this shift'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {canClockIn && (
                <Button
                  size="lg"
                  className="h-16 w-full text-lg"
                  onClick={handleClockIn}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Clock className="mr-2 h-5 w-5" />
                  )}
                  Clock In
                </Button>
              )}

              {canClockOut && (
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-16 w-full text-lg"
                  onClick={() => handleClockOut(currentShiftCheckIn.id)}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Clock className="mr-2 h-5 w-5" />
                  )}
                  Clock Out
                </Button>
              )}

              {currentShiftCheckIn?.clockOutTime && (
                <div className="flex h-16 items-center justify-center rounded-lg bg-green-50 text-green-700">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  <span className="text-lg font-medium">Shift Complete</span>
                </div>
              )}

              {!canClockIn &&
                !canClockOut &&
                !currentShiftCheckIn?.clockOutTime &&
                location.status === 'success' &&
                !isWithinGeofence && (
                  <div className="flex h-16 items-center justify-center rounded-lg bg-red-50 text-red-700">
                    <XCircle className="mr-2 h-5 w-5" />
                    <span className="text-sm">
                      You must be at the center to check in
                    </span>
                  </div>
                )}
            </CardContent>
          </Card>

          {todaysCheckIns.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Today&apos;s Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {todaysCheckIns.map((checkIn) => (
                    <div
                      key={checkIn.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="space-y-1">
                        <Badge
                          variant={
                            checkIn.shift === 'MORNING'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {checkIn.shift === 'MORNING'
                            ? 'Morning'
                            : 'Afternoon'}
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          In: {format(new Date(checkIn.clockInTime), 'h:mm a')}
                          {checkIn.clockOutTime && (
                            <>
                              {' '}
                              · Out:{' '}
                              {format(new Date(checkIn.clockOutTime), 'h:mm a')}
                            </>
                          )}
                        </div>
                      </div>
                      {checkIn.clockOutTime ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function LocationStatus({
  location,
  isWithinGeofence,
}: {
  location: LocationState
  isWithinGeofence: boolean
}) {
  if (location.status === 'idle') {
    return null
  }
  if (location.status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Verifying location...</span>
      </div>
    )
  }
  if (location.status === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
        <XCircle className="h-4 w-4" />
        <span className="text-sm">{location.error}</span>
      </div>
    )
  }
  if (!isWithinGeofence) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
        <XCircle className="h-4 w-4" />
        <span className="text-sm">
          You are not at the center. Please come to the building to check in.
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700">
      <CheckCircle className="h-4 w-4" />
      <span className="text-sm">Location verified - You are at the center</span>
    </div>
  )
}
