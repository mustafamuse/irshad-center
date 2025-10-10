'use client'

import { useState } from 'react'

import { MapPin, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { selfCheckIn } from '../../actions'

interface Student {
  id: string
  name: string
  email?: string | null
}

interface CheckInFormProps {
  token: string
  students: Student[]
}

interface LocationState {
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'error'
  coordinates?: { latitude: number; longitude: number }
  error?: string
}

export function CheckInForm({ token, students }: CheckInFormProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [location, setLocation] = useState<LocationState>({ status: 'idle' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocation({
        status: 'error',
        error: 'Geolocation is not supported by this browser.',
      })
      return
    }

    setLocation({ status: 'requesting' })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          status: 'granted',
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        })
      },
      (error) => {
        let errorMessage = 'Unable to get your location.'

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              'Location access denied. Please enable location services and try again.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.'
            break
        }

        setLocation({
          status: 'denied',
          error: errorMessage,
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }

  const handleSubmit = async () => {
    if (!selectedStudentId) {
      setResult({
        success: false,
        message: 'Please select your name from the list.',
      })
      return
    }

    if (!location.coordinates) {
      setResult({
        success: false,
        message: 'Location is required for check-in.',
      })
      return
    }

    setIsSubmitting(true)
    setResult(null)

    try {
      const result = await selfCheckIn({
        token,
        studentId: selectedStudentId,
        coordinates: location.coordinates,
      })

      setResult(result)
    } catch (error) {
      setResult({
        success: false,
        message: 'An error occurred. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Student Selection */}
      <div className="space-y-2">
        <Label htmlFor="student-select" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Select Your Name
        </Label>
        <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose your name..." />
          </SelectTrigger>
          <SelectContent>
            {students.map((student) => (
              <SelectItem key={student.id} value={student.id}>
                <div>
                  <div className="font-medium">{student.name}</div>
                  {student.email && (
                    <div className="text-xs text-gray-500">{student.email}</div>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Location */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Location Verification
        </Label>

        {location.status === 'idle' && (
          <Button
            type="button"
            variant="outline"
            onClick={requestLocation}
            className="w-full"
          >
            <MapPin className="mr-2 h-4 w-4" />
            Enable Location Access
          </Button>
        )}

        {location.status === 'requesting' && (
          <div className="flex items-center justify-center py-4 text-blue-600">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Getting your location...
          </div>
        )}

        {location.status === 'granted' && (
          <div className="flex items-center gap-2 rounded bg-green-50 p-3 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span>Location verified</span>
          </div>
        )}

        {(location.status === 'denied' || location.status === 'error') && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded bg-red-50 p-3 text-red-600">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-medium">Location Required</p>
                <p className="text-sm">{location.error}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={requestLocation}
              className="w-full"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Check-in Button */}
      <Button
        onClick={handleSubmit}
        disabled={
          !selectedStudentId ||
          location.status !== 'granted' ||
          isSubmitting ||
          result?.success === true
        }
        className="w-full"
        size="lg"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Checking In...
          </>
        ) : result?.success ? (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            Checked In Successfully
          </>
        ) : (
          'Check In'
        )}
      </Button>

      {/* Result Message */}
      {result && (
        <div
          className={`rounded-lg p-4 ${
            result.success
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle className="mt-0.5 h-5 w-5" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5" />
            )}
            <p>{result.message}</p>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="rounded bg-gray-50 p-3 text-xs text-gray-500">
        <p className="mb-1 font-medium">Need help?</p>
        <ul className="space-y-1">
          <li>• Make sure you're at the center location</li>
          <li>• Enable location services in your browser</li>
          <li>• Ask your teacher if you can't find your name</li>
        </ul>
      </div>
    </div>
  )
}
