/**
 * Geolocation Service
 *
 * Reusable service for handling GPS/location functionality.
 * Provides type-safe location data, error handling, and validation.
 *
 * Used by:
 * - Teacher check-in system (app/teacher/checkin)
 * - Any future location-based features
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LocationData {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  timestamp: number | null
}

export interface LocationCoordinates {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export type GeolocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED'
  | 'UNKNOWN'

// ============================================================================
// CONSTANTS
// ============================================================================

export const GEOLOCATION_ERROR_MESSAGES: Record<GeolocationErrorCode, string> =
  {
    PERMISSION_DENIED:
      'Location permission denied. Please enable location access in your browser settings.',
    POSITION_UNAVAILABLE:
      'Unable to determine your location. Please ensure GPS is enabled.',
    TIMEOUT: 'Location request timed out. Please try again.',
    NOT_SUPPORTED: 'Geolocation is not supported by this browser.',
    UNKNOWN: 'An unknown error occurred while getting location.',
  }

export const DEFAULT_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
}

/**
 * GPS constraints for validation
 */
export const GPS_CONSTRAINTS = {
  MAX_AGE_MS: 5 * 60 * 1000, // 5 minutes - GPS reading considered stale after this
  MIN_ACCURACY_METERS: 100, // Warn if accuracy worse than this
} as const

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Maps browser GeolocationPositionError to our error codes
 */
export function mapGeolocationError(
  error: GeolocationPositionError
): GeolocationErrorCode {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'PERMISSION_DENIED'
    case error.POSITION_UNAVAILABLE:
      return 'POSITION_UNAVAILABLE'
    case error.TIMEOUT:
      return 'TIMEOUT'
    default:
      return 'UNKNOWN'
  }
}

/**
 * Gets user-friendly error message for a geolocation error code
 */
export function getGeolocationErrorMessage(code: GeolocationErrorCode): string {
  return GEOLOCATION_ERROR_MESSAGES[code]
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Checks if GPS reading is fresh (not stale)
 *
 * @param timestamp - GPS timestamp in milliseconds
 * @param maxAgeMs - Maximum age in milliseconds (default: 5 minutes)
 * @returns true if GPS reading is fresh
 */
export function isGpsFresh(
  timestamp: number,
  maxAgeMs: number = GPS_CONSTRAINTS.MAX_AGE_MS
): boolean {
  const age = Date.now() - timestamp
  return age <= maxAgeMs
}

/**
 * Checks if GPS accuracy is acceptable
 *
 * @param accuracy - GPS accuracy in meters
 * @param threshold - Maximum acceptable accuracy (default: 100m)
 * @returns true if accuracy is acceptable
 */
export function isAccuracyAcceptable(
  accuracy: number,
  threshold: number = GPS_CONSTRAINTS.MIN_ACCURACY_METERS
): boolean {
  return accuracy <= threshold
}

/**
 * Validates location data has all required fields
 */
export function isValidLocationData(
  data: LocationData
): data is LocationData & LocationCoordinates {
  return (
    data.latitude !== null &&
    data.longitude !== null &&
    data.accuracy !== null &&
    data.timestamp !== null &&
    data.error === null
  )
}

/**
 * Creates an empty/error location data object
 */
export function createErrorLocationData(
  errorCode: GeolocationErrorCode
): LocationData {
  return {
    latitude: null,
    longitude: null,
    accuracy: null,
    error: GEOLOCATION_ERROR_MESSAGES[errorCode],
    timestamp: null,
  }
}

/**
 * Creates location data from a successful GeolocationPosition
 */
export function createLocationDataFromPosition(
  position: GeolocationPosition
): LocationData {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    error: null,
    timestamp: position.timestamp,
  }
}

// ============================================================================
// DISTANCE CALCULATION
// ============================================================================

/**
 * Calculates the distance between two geographic coordinates using the Haversine formula.
 *
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3 // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Checks if a location is within a specified radius of a center point.
 *
 * @param location - The location to check
 * @param center - The center point
 * @param radiusMeters - The radius in meters
 * @returns true if within radius, false otherwise
 */
export function isWithinRadius(
  location: { lat: number; lng: number },
  center: { lat: number; lng: number },
  radiusMeters: number
): boolean {
  const distance = calculateDistance(
    location.lat,
    location.lng,
    center.lat,
    center.lng
  )
  return distance <= radiusMeters
}

// ============================================================================
// BROWSER API WRAPPER
// ============================================================================

/**
 * Gets current position as a Promise.
 * This is a thin wrapper around the browser's Geolocation API.
 *
 * Note: This must be called from client-side code only.
 *
 * @param options - Geolocation options
 * @returns Promise resolving to LocationData
 */
export function getCurrentPosition(
  options: PositionOptions = DEFAULT_GEOLOCATION_OPTIONS
): Promise<LocationData> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(createErrorLocationData('NOT_SUPPORTED'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(createLocationDataFromPosition(position))
      },
      (error) => {
        const errorCode = mapGeolocationError(error)
        resolve(createErrorLocationData(errorCode))
      },
      options
    )
  })
}
