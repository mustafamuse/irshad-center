/**
 * Teacher Check-in Constants
 *
 * Configuration for the Dugsi teacher check-in system including
 * shift times, geofencing, and status display.
 */

import { Shift } from '@prisma/client'

// ============================================================================
// GEOFENCE CONFIGURATION
// ============================================================================

/**
 * Irshad Center location for geofencing validation.
 * Loaded from environment variables to allow configuration per deployment.
 */
export const IRSHAD_CENTER_LOCATION = {
  lat: parseFloat(process.env.IRSHAD_CENTER_LAT || '0'),
  lng: parseFloat(process.env.IRSHAD_CENTER_LNG || '0'),
} as const

/**
 * Maximum distance (in meters) from center to be considered a valid check-in.
 * 50 meters = strict, must be very close to building.
 */
export const GEOFENCE_RADIUS_METERS = 50

// ============================================================================
// SHIFT TIMING CONFIGURATION
// ============================================================================

/**
 * Shift start times. Teachers checking in after these times are marked late.
 */
export const SHIFT_START_TIMES: Record<
  Shift,
  { hour: number; minute: number }
> = {
  MORNING: { hour: 8, minute: 30 },
  AFTERNOON: { hour: 14, minute: 0 },
} as const

/**
 * Human-readable shift time labels for display.
 */
export const SHIFT_TIME_LABELS: Record<Shift, string> = {
  MORNING: '8:30 AM',
  AFTERNOON: '2:00 PM',
} as const

// ============================================================================
// STATUS BADGES
// ============================================================================

export const CHECKIN_STATUS_BADGES = {
  ON_TIME: {
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
    label: 'On Time',
  },
  LATE: {
    className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
    label: 'Late',
  },
  CHECKED_IN: {
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
    label: 'Checked In',
  },
  NOT_CHECKED_IN: {
    className: 'bg-gray-100 text-gray-500 hover:bg-gray-100',
    label: 'Not Checked In',
  },
  CLOCKED_OUT: {
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    label: 'Clocked Out',
  },
} as const

export const LOCATION_STATUS_BADGES = {
  VALID: {
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
    label: 'Valid Location',
  },
  INVALID: {
    className: 'bg-red-100 text-red-800 hover:bg-red-100',
    label: 'Invalid Location',
  },
  UNKNOWN: {
    className: 'bg-gray-100 text-gray-500 hover:bg-gray-100',
    label: 'No Location',
  },
} as const

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determines if a check-in time is late for a given shift.
 *
 * @param clockInTime - The time the teacher clocked in
 * @param shift - The shift being checked into
 * @returns true if the teacher is late, false otherwise
 */
export function isLateForShift(clockInTime: Date, shift: Shift): boolean {
  const shiftStart = SHIFT_START_TIMES[shift]
  const clockInHour = clockInTime.getHours()
  const clockInMinute = clockInTime.getMinutes()

  if (clockInHour > shiftStart.hour) return true
  if (clockInHour === shiftStart.hour && clockInMinute > shiftStart.minute)
    return true
  return false
}

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
 * Checks if a location is within the geofence radius of Irshad Center.
 *
 * @param lat - Latitude of the location to check
 * @param lng - Longitude of the location to check
 * @returns true if within geofence, false otherwise
 */
export function isWithinGeofence(lat: number, lng: number): boolean {
  if (IRSHAD_CENTER_LOCATION.lat === 0 && IRSHAD_CENTER_LOCATION.lng === 0) {
    console.warn(
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

/**
 * Validates that center location environment variables are configured.
 * Call this at app startup to catch configuration errors early.
 */
export function validateCenterLocationConfig(): void {
  if (IRSHAD_CENTER_LOCATION.lat === 0 && IRSHAD_CENTER_LOCATION.lng === 0) {
    throw new Error(
      'Teacher check-in requires IRSHAD_CENTER_LAT and IRSHAD_CENTER_LNG environment variables to be set'
    )
  }
}

// ============================================================================
// ERROR CODES
// ============================================================================

export const CHECKIN_ERROR_CODES = {
  TEACHER_NOT_FOUND: 'TEACHER_NOT_FOUND',
  NOT_ENROLLED_IN_DUGSI: 'NOT_ENROLLED_IN_DUGSI',
  INVALID_SHIFT: 'INVALID_SHIFT',
  DUPLICATE_CHECKIN: 'DUPLICATE_CHECKIN',
  CHECKIN_NOT_FOUND: 'CHECKIN_NOT_FOUND',
  ALREADY_CLOCKED_OUT: 'ALREADY_CLOCKED_OUT',
  GPS_REQUIRED: 'GPS_REQUIRED',
} as const
