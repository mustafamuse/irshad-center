import { Gender } from '@prisma/client'
import {
  getGenderDisplay,
  formatGenderDisplay,
  getGenderIcon,
  isValidGender,
  getGenderLabel,
  GENDER_OPTIONS,
} from '../gender-utils'

describe('Gender Utils', () => {
  describe('GENDER_OPTIONS', () => {
    it('should have correct structure', () => {
      expect(GENDER_OPTIONS).toHaveLength(2)
      expect(GENDER_OPTIONS[0]).toEqual({ value: 'MALE', label: 'Boy' })
      expect(GENDER_OPTIONS[1]).toEqual({ value: 'FEMALE', label: 'Girl' })
    })
  })

  describe('getGenderDisplay', () => {
    it('should return correct display for MALE', () => {
      const result = getGenderDisplay('MALE')
      expect(result).toEqual({
        label: 'Boy',
        iconColor: 'text-blue-500',
        labelColor: 'text-blue-600',
      })
    })

    it('should return correct display for FEMALE', () => {
      const result = getGenderDisplay('FEMALE')
      expect(result).toEqual({
        label: 'Girl',
        iconColor: 'text-pink-500',
        labelColor: 'text-pink-600',
      })
    })

    it('should return null for invalid gender', () => {
      expect(getGenderDisplay(null)).toBeNull()
      expect(getGenderDisplay('')).toBeNull()
      expect(getGenderDisplay('INVALID')).toBeNull()
    })
  })

  describe('isValidGender', () => {
    it('should validate MALE and FEMALE', () => {
      expect(isValidGender('MALE')).toBe(true)
      expect(isValidGender('FEMALE')).toBe(true)
    })

    it('should reject invalid values', () => {
      expect(isValidGender(null)).toBe(false)
      expect(isValidGender('')).toBe(false)
      expect(isValidGender('INVALID')).toBe(false)
      expect(isValidGender(123)).toBe(false)
    })
  })

  describe('getGenderLabel', () => {
    it('should return correct labels', () => {
      expect(getGenderLabel('MALE')).toBe('Boy')
      expect(getGenderLabel('FEMALE')).toBe('Girl')
    })

    it('should return fallback for invalid gender', () => {
      expect(getGenderLabel(null)).toBe('—')
      expect(getGenderLabel('INVALID')).toBe('—')
    })
  })

  describe('formatGenderDisplay', () => {
    it('should return null for invalid gender', () => {
      const result = formatGenderDisplay(null)
      expect(result).toBeNull()
    })

    it('should return null for invalid gender with fallback', () => {
      const result = formatGenderDisplay('INVALID', { fallback: 'N/A' })
      expect(result).toBeNull()
    })
  })

  describe('getGenderIcon', () => {
    it('should return fallback for invalid gender', () => {
      const result = getGenderIcon(null)
      expect(result).toEqual(
        expect.objectContaining({
          type: 'span',
          props: expect.objectContaining({
            className: 'text-xs text-muted-foreground',
            children: '—',
          }),
        })
      )
    })
  })
})
