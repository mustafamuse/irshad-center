'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SHIFT_TIME_LABELS } from '@/lib/constants/teacher-checkin'

import {
  checkGeofence,
  getTeacherCurrentStatus,
  teacherClockInAction,
  teacherClockOutAction,
  type GeofenceCheckResult,
  type TeacherCurrentStatus,
  type TeacherForDropdown,
} from '../actions'
import { TeacherSelector } from './teacher-selector'
import { useGeolocation } from './use-geolocation'

interface CheckinFormProps {
  teachers: TeacherForDropdown[]
}

export function CheckinForm({ teachers }: CheckinFormProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(
    null
  )
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [status, setStatus] = useState<TeacherCurrentStatus | null>(null)
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'warning'
    text: string
  } | null>(null)
  const [geofenceStatus, setGeofenceStatus] =
    useState<GeofenceCheckResult | null>(null)

  const [isPending, startTransition] = useTransition()
  const {
    location,
    isLoading: isGeoLoading,
    requestLocation,
    hasLocation,
    hasError,
  } = useGeolocation()

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId)
  const availableShifts = selectedTeacher?.shifts ?? []

  useEffect(() => {
    if (selectedTeacherId) {
      const teacher = teachers.find((t) => t.id === selectedTeacherId)
      const shifts = teacher?.shifts ?? []

      startTransition(async () => {
        const currentStatus = await getTeacherCurrentStatus(selectedTeacherId)
        setStatus(currentStatus)

        if (shifts.length === 1) {
          setSelectedShift(shifts[0])
        } else {
          setSelectedShift(null)
        }
      })
    } else {
      setStatus(null)
      setSelectedShift(null)
    }
  }, [selectedTeacherId, teachers])

  const handleRequestLocation = useCallback(async () => {
    setMessage(null)
    setGeofenceStatus(null)
    const loc = await requestLocation()
    if (loc.latitude !== null && loc.longitude !== null) {
      const result = await checkGeofence(loc.latitude, loc.longitude)
      setGeofenceStatus(result)
      if (!result.isWithinGeofence) {
        setMessage({
          type: 'warning',
          text: `You are ${result.distanceMeters}m away from the center. Check-in will be marked as invalid location.`,
        })
      }
    }
  }, [requestLocation])

  const getCurrentCheckin = () => {
    if (!status || !selectedShift) return null
    if (selectedShift === Shift.MORNING) {
      return status.morningCheckinId
        ? {
            id: status.morningCheckinId,
            clockInTime: status.morningClockInTime,
            clockOutTime: status.morningClockOutTime,
          }
        : null
    }
    return status.afternoonCheckinId
      ? {
          id: status.afternoonCheckinId,
          clockInTime: status.afternoonClockInTime,
          clockOutTime: status.afternoonClockOutTime,
        }
      : null
  }

  const currentCheckin = getCurrentCheckin()
  const isClockedIn = currentCheckin !== null
  const isClockedOut = currentCheckin?.clockOutTime !== null

  const handleClockIn = async () => {
    if (
      !selectedTeacherId ||
      !selectedShift ||
      !location.latitude ||
      !location.longitude
    ) {
      return
    }

    setMessage(null)

    startTransition(async () => {
      const result = await teacherClockInAction({
        teacherId: selectedTeacherId,
        shift: selectedShift,
        latitude: location.latitude!,
        longitude: location.longitude!,
      })

      if (result.success && result.data) {
        setMessage({ type: 'success', text: result.message ?? 'Clocked in!' })
        setStatus(result.data.status)
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Clock-in failed' })
      }
    })
  }

  const handleClockOut = async () => {
    if (
      !currentCheckin?.id ||
      !selectedTeacherId ||
      !location.latitude ||
      !location.longitude
    ) {
      return
    }

    setMessage(null)

    startTransition(async () => {
      const result = await teacherClockOutAction({
        checkInId: currentCheckin.id,
        teacherId: selectedTeacherId,
        latitude: location.latitude!,
        longitude: location.longitude!,
      })

      if (result.success && result.data) {
        setMessage({ type: 'success', text: result.message ?? 'Clocked out!' })
        setStatus(result.data.status)
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Clock-out failed' })
      }
    })
  }

  const formatTime = (date: Date | null) => {
    if (!date) return null
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Your Name</CardTitle>
        </CardHeader>
        <CardContent>
          <TeacherSelector
            teachers={teachers}
            selectedTeacherId={selectedTeacherId}
            onSelect={(id) => {
              setSelectedTeacherId(id)
              setMessage(null)
              setGeofenceStatus(null)
            }}
            disabled={isPending}
          />
        </CardContent>
      </Card>

      {selectedTeacherId && (
        <>
          {availableShifts.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Shift</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedShift ?? undefined}
                  onValueChange={(v) => setSelectedShift(v as Shift)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select shift..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableShifts.map((shift) => (
                      <SelectItem key={shift} value={shift} className="py-3">
                        {shift} - {SHIFT_TIME_LABELS[shift]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {selectedShift && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5" />
                    Current Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isPending && !status ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : isClockedIn && isClockedOut ? (
                    <div className="space-y-2">
                      <Badge
                        variant="outline"
                        className="bg-blue-100 text-blue-800"
                      >
                        Shift Complete
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        Clocked in at{' '}
                        {formatTime(currentCheckin?.clockInTime ?? null)}, out
                        at {formatTime(currentCheckin?.clockOutTime ?? null)}
                      </p>
                    </div>
                  ) : isClockedIn ? (
                    <div className="space-y-2">
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800"
                      >
                        Clocked In
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        Since {formatTime(currentCheckin?.clockInTime ?? null)}
                      </p>
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-gray-100 text-gray-600"
                    >
                      Not Clocked In
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasLocation ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Location acquired</span>
                        {location.accuracy && (
                          <span className="text-muted-foreground">
                            (accuracy: {Math.round(location.accuracy)}m)
                          </span>
                        )}
                      </div>
                      {geofenceStatus && (
                        <div
                          className={`flex items-center gap-2 text-sm ${
                            geofenceStatus.isWithinGeofence
                              ? 'text-green-600'
                              : 'text-orange-600'
                          }`}
                        >
                          {geofenceStatus.isWithinGeofence ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Within check-in range</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-4 w-4" />
                              <span>
                                {geofenceStatus.distanceMeters}m from center
                                (max: {geofenceStatus.allowedRadiusMeters}m)
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : hasError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Location Error</AlertTitle>
                      <AlertDescription>{location.error}</AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Location is required to clock in.
                    </p>
                  )}

                  <Button
                    variant="outline"
                    onClick={handleRequestLocation}
                    disabled={isGeoLoading || isPending}
                    className="w-full"
                  >
                    {isGeoLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Getting Location...
                      </>
                    ) : hasLocation ? (
                      <>
                        <MapPin className="mr-2 h-4 w-4" />
                        Update Location
                      </>
                    ) : (
                      <>
                        <MapPin className="mr-2 h-4 w-4" />
                        Get Location
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {message && (
                <Alert
                  variant={message.type === 'error' ? 'destructive' : 'default'}
                  className={
                    message.type === 'warning'
                      ? 'border-orange-200 bg-orange-50 text-orange-800 [&>svg]:text-orange-600'
                      : undefined
                  }
                >
                  {message.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : message.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {!isClockedIn ? (
                  <Button
                    size="lg"
                    className="h-14 w-full text-lg"
                    onClick={handleClockIn}
                    disabled={!hasLocation || isPending}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <LogIn className="mr-2 h-5 w-5" />
                    )}
                    Clock In
                  </Button>
                ) : !isClockedOut ? (
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-14 w-full text-lg"
                    onClick={handleClockOut}
                    disabled={!hasLocation || isPending}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 h-5 w-5" />
                    )}
                    Clock Out
                  </Button>
                ) : (
                  <p className="text-center text-muted-foreground">
                    You have completed your {selectedShift.toLowerCase()} shift.
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
