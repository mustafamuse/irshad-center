'use client'

import { useState, useCallback, useEffect } from 'react'

import {
  LocationData,
  getCurrentPosition,
  createErrorLocationData,
  DEFAULT_GEOLOCATION_OPTIONS,
} from '@/lib/services/geolocation-service'

export type {
  LocationData,
  GeolocationErrorCode,
} from '@/lib/services/geolocation-service'

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unknown'

export function useGeolocation() {
  const [location, setLocation] = useState<LocationData>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    timestamp: null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [permissionState, setPermissionState] =
    useState<PermissionState>('unknown')

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions) return
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setPermissionState(result.state as PermissionState)
      result.addEventListener('change', () => {
        setPermissionState(result.state as PermissionState)
      })
    })
  }, [])

  const requestLocation = useCallback(async (): Promise<LocationData> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const errorData = createErrorLocationData('NOT_SUPPORTED')
      setLocation(errorData)
      return errorData
    }

    setIsLoading(true)

    const data = await getCurrentPosition(DEFAULT_GEOLOCATION_OPTIONS)
    setLocation(data)
    setIsLoading(false)
    return data
  }, [])

  const hasLocation = location.latitude !== null && location.longitude !== null
  const hasError = location.error !== null

  return {
    location,
    isLoading,
    requestLocation,
    hasLocation,
    hasError,
    permissionState,
  }
}
