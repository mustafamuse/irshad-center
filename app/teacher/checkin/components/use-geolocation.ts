'use client'

import { useState, useCallback } from 'react'

export interface LocationData {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  timestamp: number | null
}

export type GeolocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED'
  | 'UNKNOWN'

const ERROR_MESSAGES: Record<GeolocationErrorCode, string> = {
  PERMISSION_DENIED:
    'Location permission denied. Please enable location access in your browser settings.',
  POSITION_UNAVAILABLE:
    'Unable to determine your location. Please ensure GPS is enabled.',
  TIMEOUT: 'Location request timed out. Please try again.',
  NOT_SUPPORTED: 'Geolocation is not supported by this browser.',
  UNKNOWN: 'An unknown error occurred while getting location.',
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
}

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
    if (!navigator.geolocation) {
      const errorData: LocationData = {
        latitude: null,
        longitude: null,
        accuracy: null,
        error: ERROR_MESSAGES.NOT_SUPPORTED,
        timestamp: null,
      }
      setLocation(errorData)
      return errorData
    }

    setIsLoading(true)

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const data: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            error: null,
            timestamp: position.timestamp,
          }
          setLocation(data)
          setIsLoading(false)
          resolve(data)
        },
        (error) => {
          let errorCode: GeolocationErrorCode = 'UNKNOWN'

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorCode = 'PERMISSION_DENIED'
              break
            case error.POSITION_UNAVAILABLE:
              errorCode = 'POSITION_UNAVAILABLE'
              break
            case error.TIMEOUT:
              errorCode = 'TIMEOUT'
              break
          }

          const errorData: LocationData = {
            latitude: null,
            longitude: null,
            accuracy: null,
            error: ERROR_MESSAGES[errorCode],
            timestamp: null,
          }
          setLocation(errorData)
          setIsLoading(false)
          resolve(errorData)
        },
        GEOLOCATION_OPTIONS
      )
    })
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
