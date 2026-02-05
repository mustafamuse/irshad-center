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
    let status: PermissionStatus | null = null
    const onChange = () => {
      if (status) setPermissionState(status.state as PermissionState)
    }
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        status = result
        setPermissionState(result.state as PermissionState)
        result.addEventListener('change', onChange)
      })
      .catch((err) => {
        console.warn('Permissions API not supported:', err)
        setPermissionState('prompt')
      })
    return () => {
      status?.removeEventListener('change', onChange)
    }
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
