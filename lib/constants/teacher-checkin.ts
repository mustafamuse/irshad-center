import { createClientLogger } from '@/lib/logger-client'
import { calculateDistance } from '@/lib/services/geolocation-service'

export {
  SCHOOL_TIMEZONE,
  SHIFT_START_TIMES,
  SHIFT_TIME_LABELS,
} from '@/lib/constants/shift-times'

const logger = createClientLogger('teacher-checkin')

// ============================================================================
// GEOFENCE CONFIGURATION
// ============================================================================

export const IRSHAD_CENTER_LOCATION = {
  lat: parseFloat(process.env.IRSHAD_CENTER_LAT || '0'),
  lng: parseFloat(process.env.IRSHAD_CENTER_LNG || '0'),
} as const

// 15 meters (~50ft) = must be at the building entrance.
export const GEOFENCE_RADIUS_METERS = 15

function isCenterLocationMissing(): boolean {
  return IRSHAD_CENTER_LOCATION.lat === 0 && IRSHAD_CENTER_LOCATION.lng === 0
}

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

export function isWithinGeofence(lat: number, lng: number): boolean {
  if (isCenterLocationMissing()) {
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

export function isGeofenceConfigured(): boolean {
  return !isCenterLocationMissing()
}

export function validateCenterLocationConfig(): void {
  if (isCenterLocationMissing()) {
    logger.warn(
      'IRSHAD_CENTER_LAT and IRSHAD_CENTER_LNG environment variables not set — geofence disabled'
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
  SYSTEM_NOT_CONFIGURED: 'SYSTEM_NOT_CONFIGURED',
  OUTSIDE_GEOFENCE: 'OUTSIDE_GEOFENCE',
  INVALID_TIME_ORDER: 'INVALID_TIME_ORDER',
  // Fired when a concurrent admin override or auto-mark changed the attendance
  // record status between our read and our updateMany write (optimistic lock).
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
  // Fired when a teacher tries to clock in on a date the school is closed.
  // Tells the teacher to contact an admin rather than retrying GPS.
  SCHOOL_CLOSED: 'SCHOOL_CLOSED',
} as const
