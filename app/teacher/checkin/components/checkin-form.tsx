'use client'

import { useMemo } from 'react'

import { Shift } from '@prisma/client'
import { format } from 'date-fns'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Sun,
  Sunset,
  User,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { useTeacherContextQuery } from '@/lib/features/attendance/hooks/teacher'
import { useTeacherCheckinController } from '@/lib/features/attendance/hooks/teacher-controller'

import type { TeacherForDropdown } from '../actions'
import { CheckinHistory } from './checkin-history'
import { ClockInButton } from './clock-in-button'
import { GeofenceValidator } from './geofence-validator'
import { OnboardingModal } from './onboarding-modal'
import { TeacherSelector } from './teacher-selector'
import { useCheckinOnboarding } from './use-checkin-onboarding'

interface CheckinFormProps {
  teachers: TeacherForDropdown[]
  phase2ExcuseEnabled?: boolean
}

function formatTime(date: Date | string | null): string | null {
  if (!date) return null
  return format(new Date(date), 'h:mm a')
}

export function CheckinForm({
  teachers,
  phase2ExcuseEnabled = false,
}: CheckinFormProps) {
  const { showOnboarding, dismissOnboarding, resetOnboarding } =
    useCheckinOnboarding()

  const {
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
  } = useTeacherCheckinController()

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId)
  const availableShifts = selectedTeacher?.shifts ?? []

  const contextQuery = useTeacherContextQuery(selectedTeacherId)
  const contextData = contextQuery.data
  const isContextLoading = contextQuery.isLoading || contextQuery.isFetching

  const currentCheckin = useMemo(() => {
    if (!contextData || !selectedShift) return null
    if (selectedShift === Shift.MORNING) {
      return contextData.morningCheckinId
        ? {
            id: contextData.morningCheckinId,
            clockInTime: contextData.morningClockInTime,
            clockOutTime: contextData.morningClockOutTime,
          }
        : null
    }
    return contextData.afternoonCheckinId
      ? {
          id: contextData.afternoonCheckinId,
          clockInTime: contextData.afternoonClockInTime,
          clockOutTime: contextData.afternoonClockOutTime,
        }
      : null
  }, [contextData, selectedShift])

  const isClockedIn = currentCheckin !== null
  const isClockedOut = isClockedIn && currentCheckin.clockOutTime !== null

  const locationCoordsForButton =
    locationCoords.latitude !== null && locationCoords.longitude !== null
      ? {
          latitude: locationCoords.latitude,
          longitude: locationCoords.longitude,
        }
      : null

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
              handleTeacherChange(id)
              setMessage(null)
              const teacher = teachers.find((t) => t.id === id)
              if (teacher && teacher.shifts.length === 1) {
                setSelectedShift(teacher.shifts[0])
              }
            }}
            disabled={isContextLoading}
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
                  disabled={isContextLoading}
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
                  {isContextLoading && !contextData ? (
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
                        Clocked in at {formatTime(currentCheckin.clockInTime)},
                        out at {formatTime(currentCheckin.clockOutTime)}
                      </p>
                    </div>
                  ) : isClockedIn ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                        </span>
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-800"
                        >
                          Shift In Progress
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Clocked in at {formatTime(currentCheckin.clockInTime)}
                      </p>
                      <p className="text-sm font-medium text-amber-700">
                        Remember to clock out before leaving
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

              <GeofenceValidator
                shift={selectedShift}
                onGeofenceResult={setGeofenceStatus}
                onLocationChange={(lat, lng) =>
                  setLocationCoords({ latitude: lat, longitude: lng })
                }
              />

              {message &&
                (message.type === 'success' ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                    <CheckCircle2 className="mx-auto mb-1.5 h-6 w-6 text-green-600" />
                    <p className="text-sm font-medium text-green-800">
                      {message.text}
                    </p>
                  </div>
                ) : (
                  <Alert
                    variant={
                      message.type === 'error' ? 'destructive' : 'default'
                    }
                    className={
                      message.type === 'warning'
                        ? 'border-[#deb43e]/40 bg-[#deb43e]/10 text-[#996b1d] [&>svg]:text-[#deb43e]'
                        : undefined
                    }
                  >
                    {message.type === 'warning' ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                ))}

              <div className="space-y-3">
                <ClockInButton
                  teacherId={selectedTeacherId}
                  shift={selectedShift}
                  geofenceStatus={geofenceStatus}
                  locationCoords={locationCoordsForButton}
                  currentCheckin={currentCheckin}
                  isContextLoading={isContextLoading}
                  onClockIn={(msg) =>
                    setMessage({ type: 'success', text: msg })
                  }
                  onClockOut={(msg) =>
                    setMessage({ type: 'success', text: msg })
                  }
                  onError={(msg) => setMessage({ type: 'error', text: msg })}
                />
              </div>
            </>
          )}
        </>
      )}

      {phase2ExcuseEnabled && (
        <CheckinHistory
          teacherId={selectedTeacherId}
          sessionToken={contextData?.sessionToken ?? null}
          isOpen={historyOpen}
          onOpenChange={setHistoryOpen}
          phase2Enabled={phase2ExcuseEnabled}
        />
      )}

      <OnboardingModal open={showOnboarding} onDismiss={dismissOnboarding} />
    </div>
  )
}
