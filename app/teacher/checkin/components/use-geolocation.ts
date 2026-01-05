'use client'

import { useState, useCallback } from 'react'

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

export function useGeolocation() {
  const [location, setLocation] = useState<LocationData>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    timestamp: null,
  })
  const [isLoading, setIsLoading] = useState(false)

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
  }
}
