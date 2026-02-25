import { createServiceLogger } from '@/lib/logger'
import { calculateDistance } from '@/lib/services/geolocation-service'

const logger = createServiceLogger('teacher-checkin-geofence')

export const IRSHAD_CENTER_LOCATION = {
  lat: parseFloat(process.env.IRSHAD_CENTER_LAT || '0'),
  lng: parseFloat(process.env.IRSHAD_CENTER_LNG || '0'),
} as const

export const GEOFENCE_RADIUS_METERS = 15

export function isWithinGeofence(lat: number, lng: number): boolean {
  if (IRSHAD_CENTER_LOCATION.lat === 0 && IRSHAD_CENTER_LOCATION.lng === 0) {
    logger.warn(
      'IRSHAD_CENTER_LAT and IRSHAD_CENTER_LNG environment variables not set'
    )
    return false
  }

  const distance = calculateDistance(
    lat,
    lng,
    IRSHAD_CENTER_LOCATION.lat,
    IRSHAD_CENTER_LOCATION.lng
  )
  return distance <= GEOFENCE_RADIUS_METERS
}

export function validateCenterLocationConfig(): void {
  if (IRSHAD_CENTER_LOCATION.lat === 0 && IRSHAD_CENTER_LOCATION.lng === 0) {
    throw new Error(
      'Teacher check-in requires IRSHAD_CENTER_LAT and IRSHAD_CENTER_LNG environment variables to be set'
    )
  }
}

export function isGeofenceConfigured(): boolean {
  return !(IRSHAD_CENTER_LOCATION.lat === 0 && IRSHAD_CENTER_LOCATION.lng === 0)
}
