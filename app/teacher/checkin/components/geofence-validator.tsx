'use client'

import { useCallback, useEffect, useState } from 'react'

import { Shift } from '@prisma/client'
import { AlertCircle, CheckCircle2, Loader2, MapPin } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { METERS_TO_FEET } from '@/lib/services/geolocation-service'

import { checkGeofence, type GeofenceCheckResult } from '../actions'
import { useGeolocation } from './use-geolocation'

function formatDistance(meters: number): string {
  const feet = meters * METERS_TO_FEET
  if (feet >= 1000) {
    const miles = feet / 5280
    return `${miles.toFixed(1)} miles`
  }
  return `${Math.round(feet)}ft`
}

interface GeofenceValidatorProps {
  shift: Shift | null
  onGeofenceResult: (result: GeofenceCheckResult | null) => void
  onLocationChange?: (latitude: number | null, longitude: number | null) => void
}

export function GeofenceValidator({
  shift,
  onGeofenceResult,
  onLocationChange,
}: GeofenceValidatorProps) {
  const [geofenceStatus, setGeofenceStatus] =
    useState<GeofenceCheckResult | null>(null)

  const {
    location,
    isLoading: isGeoLoading,
    requestLocation,
    hasLocation,
    hasError,
    permissionState,
  } = useGeolocation()

  useEffect(() => {
    onGeofenceResult(geofenceStatus)
  }, [geofenceStatus, onGeofenceResult])

  // Forward an already-available location to the parent immediately (e.g. permission was
  // previously granted and the browser returns coords without a user gesture).
  useEffect(() => {
    if (
      hasLocation &&
      location.latitude !== null &&
      location.longitude !== null
    ) {
      onLocationChange?.(location.latitude, location.longitude)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when hasLocation flips
  }, [hasLocation])

  const handleRequestLocation = useCallback(async () => {
    setGeofenceStatus(null)
    onLocationChange?.(null, null)
    const loc = await requestLocation()
    if (loc.latitude !== null && loc.longitude !== null) {
      onLocationChange?.(loc.latitude, loc.longitude)
      try {
        const result = await checkGeofence(loc.latitude, loc.longitude)
        setGeofenceStatus(result)
      } catch {
        setGeofenceStatus(null)
      }
    }
  }, [requestLocation, onLocationChange])

  useEffect(() => {
    if (
      shift &&
      !hasLocation &&
      !isGeoLoading &&
      permissionState === 'granted'
    ) {
      handleRequestLocation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omits handleRequestLocation (stable useCallback)
  }, [shift, permissionState])

  if (!shift) return null

  if (hasLocation && geofenceStatus?.isWithinGeofence) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm duration-300 animate-in fade-in slide-in-from-bottom-2 [animation-delay:150ms]">
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span>At Irshad Center</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRequestLocation}
          disabled={isGeoLoading}
          className="h-auto px-2 py-1 text-xs text-muted-foreground"
        >
          {isGeoLoading ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <MapPin className="mr-1 h-3 w-3" />
          )}
          Refresh
        </Button>
      </div>
    )
  }

  return (
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
        {hasLocation && geofenceStatus && !geofenceStatus.isWithinGeofence ? (
          <>
            <div className="flex items-center gap-2 text-sm font-medium text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>
                {formatDistance(geofenceStatus.distanceMeters)} away
                {' \u2022 '}
                Must be within{' '}
                {Math.round(
                  geofenceStatus.allowedRadiusMeters * METERS_TO_FEET
                )}
                ft
              </span>
            </div>
            <Button
              variant="outline"
              onClick={handleRequestLocation}
              disabled={isGeoLoading}
              className="w-full"
            >
              <MapPin className="mr-2 h-4 w-4" />
              Retry Location
            </Button>
          </>
        ) : permissionState === 'denied' ? (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Location Blocked</AlertTitle>
              <AlertDescription>
                Tap the lock icon in your browser&apos;s address bar, set
                Location to &quot;Allow&quot;, then reload.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </div>
        ) : hasError ? (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could Not Get Location</AlertTitle>
              <AlertDescription>
                Make sure you are not in airplane mode and have a clear view of
                the sky, then try again.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRequestLocation}
              disabled={isGeoLoading}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Retry Location
            </Button>
          </div>
        ) : isGeoLoading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Getting your location…</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-[#007078]/20 bg-[#007078]/5 p-3">
              <p className="text-sm font-medium text-[#007078]">
                Your browser will ask for location access
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap{' '}
                <span className="font-medium text-foreground">
                  &quot;Allow&quot;
                </span>{' '}
                when you see the popup to verify you are at the center.
              </p>
            </div>
            <Button
              className="w-full bg-[#007078] text-white hover:bg-[#005a61]"
              onClick={handleRequestLocation}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Enable Location
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
