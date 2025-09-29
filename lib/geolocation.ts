// Center coordinates - should be configured in environment variables
const CENTER_LAT = parseFloat(process.env.CENTER_LATITUDE || '0')
const CENTER_LNG = parseFloat(process.env.CENTER_LONGITUDE || '0')
const ALLOWED_RADIUS_METERS = parseInt(process.env.GEOFENCE_RADIUS || '100')

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface GeofenceResult {
  isWithinBounds: boolean
  distance: number
  maxDistance: number
}

/**
 * Calculate distance between two coordinates using the Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (coord1.latitude * Math.PI) / 180
  const φ2 = (coord2.latitude * Math.PI) / 180
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Check if user coordinates are within the allowed geofence
 */
export function validateGeofence(userCoords: Coordinates): GeofenceResult {
  const centerCoords: Coordinates = {
    latitude: CENTER_LAT,
    longitude: CENTER_LNG,
  }

  const distance = calculateDistance(userCoords, centerCoords)
  const isWithinBounds = distance <= ALLOWED_RADIUS_METERS

  return {
    isWithinBounds,
    distance,
    maxDistance: ALLOWED_RADIUS_METERS,
  }
}

/**
 * Check if geolocation is properly configured
 */
export function isGeolocationConfigured(): boolean {
  return CENTER_LAT !== 0 && CENTER_LNG !== 0
}

/**
 * Get center coordinates for the frontend
 */
export function getCenterCoordinates(): Coordinates {
  return {
    latitude: CENTER_LAT,
    longitude: CENTER_LNG,
  }
}

/**
 * Format distance for user display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}
