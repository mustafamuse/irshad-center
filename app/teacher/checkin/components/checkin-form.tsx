'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Sun,
  Sunset,
  User,
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
import { METERS_TO_FEET } from '@/lib/services/geolocation-service'

import {
  checkGeofence,
  getTeacherCurrentStatus,
  teacherClockInAction,
  teacherClockOutAction,
  type GeofenceCheckResult,
  type TeacherCurrentStatus,
  type TeacherForDropdown,
} from '../actions'
import { OnboardingModal } from './onboarding-modal'
import { TeacherSelector } from './teacher-selector'
import { useCheckinOnboarding } from './use-checkin-onboarding'
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
  const { showOnboarding, dismissOnboarding, resetOnboarding } =
    useCheckinOnboarding()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teachers is stable from server props
  }, [selectedTeacherId])

  const formatDistance = (meters: number): string => {
    const feet = meters * METERS_TO_FEET
    if (feet >= 1000) {
      const miles = feet / 5280
      return `${miles.toFixed(1)} miles`
    }
    return `${Math.round(feet)}ft`
  }

  const handleRequestLocation = useCallback(async () => {
    setMessage(null)
    setGeofenceStatus(null)
    const loc = await requestLocation()
    if (loc.latitude !== null && loc.longitude !== null) {
      const result = await checkGeofence(loc.latitude, loc.longitude)
      setGeofenceStatus(result)
    }
  }, [requestLocation])

  const currentCheckin = useMemo(() => {
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
  }, [status, selectedShift])
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetOnboarding}
          className="gap-1.5 text-muted-foreground hover:text-[#007078]"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="text-sm">Help</span>
        </Button>
      </div>

      <Card className="border-0 shadow-md duration-300 animate-in fade-in slide-in-from-bottom-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007078]/10">
              <User className="h-4 w-4 text-[#007078]" />
            </div>
            Select Your Name
          </CardTitle>
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
            <Card className="border-0 shadow-md duration-300 animate-in fade-in slide-in-from-bottom-2 [animation-delay:50ms]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007078]/10">
                    <Clock className="h-4 w-4 text-[#007078]" />
                  </div>
                  Select Shift
                </CardTitle>
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
                        <span className="flex items-center gap-2">
                          {shift === 'MORNING' ? (
                            <Sun className="h-4 w-4 text-[#deb43e]" />
                          ) : (
                            <Sunset className="h-4 w-4 text-[#007078]" />
                          )}
                          {shift.charAt(0) + shift.slice(1).toLowerCase()} -{' '}
                          {SHIFT_TIME_LABELS[shift]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {selectedShift && (
            <>
              <Card className="border-0 shadow-md duration-300 animate-in fade-in slide-in-from-bottom-2 [animation-delay:100ms]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007078]/10">
                      <Clock className="h-4 w-4 text-[#007078]" />
                    </div>
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

              <Card className="border-0 shadow-md duration-300 animate-in fade-in slide-in-from-bottom-2 [animation-delay:150ms]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007078]/10">
                      <MapPin className="h-4 w-4 text-[#007078]" />
                    </div>
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasLocation ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Location acquired</span>
                      </div>
                      {geofenceStatus && (
                        <div
                          className={`flex items-center gap-2 text-sm font-medium ${
                            geofenceStatus.isWithinGeofence
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {geofenceStatus.isWithinGeofence ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              <span>
                                Within{' '}
                                {Math.round(
                                  geofenceStatus.allowedRadiusMeters *
                                    METERS_TO_FEET
                                )}
                                ft of center
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4" />
                              <span>
                                {formatDistance(geofenceStatus.distanceMeters)}{' '}
                                away
                                {' \u2022 '}
                                Must be within{' '}
                                {Math.round(
                                  geofenceStatus.allowedRadiusMeters *
                                    METERS_TO_FEET
                                )}
                                ft
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
                      ? 'border-[#deb43e]/40 bg-[#deb43e]/10 text-[#996b1d] [&>svg]:text-[#deb43e]'
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
                    className="h-14 w-full bg-[#007078] text-lg shadow-lg shadow-[#007078]/25 transition-all hover:bg-[#005a61] hover:shadow-xl hover:shadow-[#007078]/30 hover:ring-2 hover:ring-[#deb43e]/50 hover:ring-offset-1 active:scale-[0.98]"
                    onClick={handleClockIn}
                    disabled={
                      !hasLocation ||
                      isPending ||
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
                ) : !isClockedOut ? (
                  <Button
                    size="lg"
                    className="h-14 w-full border-2 border-[#007078] bg-white text-lg text-[#007078] shadow-md transition-all hover:bg-[#007078]/5 hover:shadow-lg active:scale-[0.98]"
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
                  <div className="rounded-xl border-2 border-dashed border-green-200 bg-green-50/50 p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="font-medium text-green-800">Shift Complete</p>
                    <p className="mt-1 text-sm text-green-600">
                      You have completed your {selectedShift.toLowerCase()}{' '}
                      shift.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <OnboardingModal open={showOnboarding} onDismiss={dismissOnboarding} />
    </div>
  )
}
