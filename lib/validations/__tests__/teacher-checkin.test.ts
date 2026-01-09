import { describe, it, expect } from 'vitest'

import { UpdateCheckinSchema, DeleteCheckinSchema } from '../teacher-checkin'

describe('UpdateCheckinSchema', () => {
  const validCheckInId = '123e4567-e89b-12d3-a456-426614174000'

  describe('clockOutTime > clockInTime validation', () => {
    it('should pass when clockOutTime is after clockInTime', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
        clockInTime: new Date('2024-01-15T08:30:00'),
        clockOutTime: new Date('2024-01-15T12:30:00'),
      })

      expect(result.success).toBe(true)
    })

    it('should fail when clockOutTime is before clockInTime', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
        clockInTime: new Date('2024-01-15T12:30:00'),
        clockOutTime: new Date('2024-01-15T08:30:00'),
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe(
          'Clock out time must be after clock in time'
        )
        expect(result.error.errors[0].path).toContain('clockOutTime')
      }
    })

    it('should fail when clockOutTime equals clockInTime', () => {
      const sameTime = new Date('2024-01-15T12:30:00')
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
        clockInTime: sameTime,
        clockOutTime: sameTime,
      })

      expect(result.success).toBe(false)
    })

    it('should pass when only clockInTime is provided', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
        clockInTime: new Date('2024-01-15T08:30:00'),
      })

      expect(result.success).toBe(true)
    })

    it('should pass when only clockOutTime is provided', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
        clockOutTime: new Date('2024-01-15T12:30:00'),
      })

      expect(result.success).toBe(true)
    })

    it('should pass when clockOutTime is null', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
        clockInTime: new Date('2024-01-15T08:30:00'),
        clockOutTime: null,
      })

      expect(result.success).toBe(true)
    })

    it('should pass when neither time is provided', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
        isLate: false,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('checkInId validation', () => {
    it('should fail with invalid UUID', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: 'not-a-uuid',
      })

      expect(result.success).toBe(false)
    })

    it('should pass with valid UUID', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('notes validation', () => {
    it('should fail when notes exceed 500 characters', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
        notes: 'a'.repeat(501),
      })

      expect(result.success).toBe(false)
    })

    it('should pass when notes are exactly 500 characters', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
        notes: 'a'.repeat(500),
      })

      expect(result.success).toBe(true)
    })

    it('should pass when notes are null', () => {
      const result = UpdateCheckinSchema.safeParse({
        checkInId: validCheckInId,
        notes: null,
      })

      expect(result.success).toBe(true)
    })
  })
})

describe('DeleteCheckinSchema', () => {
  it('should pass with valid UUID', () => {
    const result = DeleteCheckinSchema.safeParse({
      checkInId: '123e4567-e89b-12d3-a456-426614174000',
    })

    expect(result.success).toBe(true)
  })

  it('should fail with invalid UUID', () => {
    const result = DeleteCheckinSchema.safeParse({
      checkInId: 'not-a-uuid',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Invalid check-in ID')
    }
  })

  it('should fail with missing checkInId', () => {
    const result = DeleteCheckinSchema.safeParse({})

    expect(result.success).toBe(false)
  })
})
