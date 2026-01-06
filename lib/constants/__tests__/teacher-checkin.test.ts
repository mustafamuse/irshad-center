import { Shift } from '@prisma/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { calculateDistance } from '@/lib/services/geolocation-service'

import {
  isLateForShift,
  isWithinGeofence,
  SHIFT_START_TIMES,
  GEOFENCE_RADIUS_METERS,
} from '../teacher-checkin'

describe('isLateForShift', () => {
  describe('MORNING shift (8:30 AM)', () => {
    it('should return false when clock-in is before 8:30', () => {
      const clockIn = new Date('2024-01-15T08:00:00')
      expect(isLateForShift(clockIn, Shift.MORNING)).toBe(false)
    })

    it('should return false when clock-in is exactly at 8:30', () => {
      const clockIn = new Date('2024-01-15T08:30:00')
      expect(isLateForShift(clockIn, Shift.MORNING)).toBe(false)
    })

    it('should return true when clock-in is at 8:31', () => {
      const clockIn = new Date('2024-01-15T08:31:00')
      expect(isLateForShift(clockIn, Shift.MORNING)).toBe(true)
    })

    it('should return true when clock-in is at 9:00', () => {
      const clockIn = new Date('2024-01-15T09:00:00')
      expect(isLateForShift(clockIn, Shift.MORNING)).toBe(true)
    })
  })

  describe('AFTERNOON shift (2:00 PM)', () => {
    it('should return false when clock-in is before 14:00', () => {
      const clockIn = new Date('2024-01-15T13:30:00')
      expect(isLateForShift(clockIn, Shift.AFTERNOON)).toBe(false)
    })

    it('should return false when clock-in is exactly at 14:00', () => {
      const clockIn = new Date('2024-01-15T14:00:00')
      expect(isLateForShift(clockIn, Shift.AFTERNOON)).toBe(false)
    })

    it('should return true when clock-in is at 14:01', () => {
      const clockIn = new Date('2024-01-15T14:01:00')
      expect(isLateForShift(clockIn, Shift.AFTERNOON)).toBe(true)
    })

    it('should return true when clock-in is at 15:00', () => {
      const clockIn = new Date('2024-01-15T15:00:00')
      expect(isLateForShift(clockIn, Shift.AFTERNOON)).toBe(true)
    })
  })
})

describe('calculateDistance', () => {
  it('should return 0 for same coordinates', () => {
    const distance = calculateDistance(44.9778, -93.265, 44.9778, -93.265)
    expect(distance).toBe(0)
  })

  it('should calculate distance between two points accurately', () => {
    const lat1 = 44.9778
    const lng1 = -93.265
    const lat2 = 44.9788
    const lng2 = -93.266
    const distance = calculateDistance(lat1, lng1, lat2, lng2)
    expect(distance).toBeGreaterThan(100)
    expect(distance).toBeLessThan(200)
  })

  it('should return approximately 111km for 1 degree latitude change at equator', () => {
    const distance = calculateDistance(0, 0, 1, 0)
    expect(distance).toBeGreaterThan(110000)
    expect(distance).toBeLessThan(112000)
  })

  it('should handle negative coordinates (southern hemisphere)', () => {
    const distance = calculateDistance(-33.8688, 151.2093, -33.8698, 151.2103)
    expect(distance).toBeGreaterThan(0)
    expect(distance).toBeLessThan(200)
  })

  it('should handle negative coordinates (western hemisphere)', () => {
    const distance = calculateDistance(40.7128, -74.006, 40.7138, -74.007)
    expect(distance).toBeGreaterThan(0)
    expect(distance).toBeLessThan(200)
  })

  it('should handle crossing the prime meridian', () => {
    const distance = calculateDistance(51.5074, -0.001, 51.5074, 0.001)
    expect(distance).toBeGreaterThan(0)
    expect(distance).toBeLessThan(500)
  })
})

describe('isWithinGeofence', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return false when center location is not configured', () => {
    const result = isWithinGeofence(44.9778, -93.265)
    expect(result).toBe(false)
  })

  it('should validate geofence radius is 15 meters', () => {
    expect(GEOFENCE_RADIUS_METERS).toBe(15)
  })

  it('should validate shift start times are correct', () => {
    expect(SHIFT_START_TIMES.MORNING).toEqual({ hour: 8, minute: 30 })
    expect(SHIFT_START_TIMES.AFTERNOON).toEqual({ hour: 14, minute: 0 })
  })
})
