/**
 * Format Utilities Tests
 *
 * Tests for formatting utilities
 */

import { describe, it, expect } from 'vitest'

import { DugsiRegistration } from '../../_types'
import {
  formatParentName,
  hasSecondParent,
  formatRegistrationDate,
  calculateAge,
} from '../format'

describe('formatParentName', () => {
  it('should combine first and last name', () => {
    expect(formatParentName('John', 'Doe')).toBe('John Doe')
  })

  it('should handle only first name', () => {
    expect(formatParentName('John', null)).toBe('John')
  })

  it('should handle only last name', () => {
    expect(formatParentName(null, 'Doe')).toBe('Doe')
  })

  it('should return "Not provided" when both are missing', () => {
    expect(formatParentName(null, null)).toBe('Not provided')
  })

  it('should handle empty strings', () => {
    expect(formatParentName('', '')).toBe('Not provided')
  })

  it('should handle whitespace in names', () => {
    // formatParentName doesn't trim, just joins with space
    // '  John  ' + ' ' + '  Doe  ' = '  John     Doe  '
    expect(formatParentName('  John  ', '  Doe  ')).toBe('  John     Doe  ')
  })
})

describe('hasSecondParent', () => {
  it('should return true when parent2FirstName exists', () => {
    const registration: Partial<DugsiRegistration> = {
      parent2FirstName: 'Jane',
      parent2LastName: null,
    }
    expect(hasSecondParent(registration as DugsiRegistration)).toBe(true)
  })

  it('should return true when parent2LastName exists', () => {
    const registration: Partial<DugsiRegistration> = {
      parent2FirstName: null,
      parent2LastName: 'Smith',
    }
    expect(hasSecondParent(registration as DugsiRegistration)).toBe(true)
  })

  it('should return true when both parent2 fields exist', () => {
    const registration: Partial<DugsiRegistration> = {
      parent2FirstName: 'Jane',
      parent2LastName: 'Smith',
    }
    expect(hasSecondParent(registration as DugsiRegistration)).toBe(true)
  })

  it('should return false when neither parent2 field exists', () => {
    const registration: Partial<DugsiRegistration> = {
      parent2FirstName: null,
      parent2LastName: null,
    }
    expect(hasSecondParent(registration as DugsiRegistration)).toBe(false)
  })
})

describe('formatRegistrationDate', () => {
  it('should format Date object', () => {
    const date = new Date('2024-01-15')
    const result = formatRegistrationDate(date)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('should format date string', () => {
    const dateStr = '2024-01-15'
    const result = formatRegistrationDate(dateStr)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('should return "—" for null', () => {
    expect(formatRegistrationDate(null)).toBe('—')
  })

  it('should return "—" for undefined', () => {
    expect(formatRegistrationDate(undefined as unknown as null)).toBe('—')
  })
})

describe('calculateAge', () => {
  it('should calculate age correctly', () => {
    const today = new Date()
    const birthYear = today.getFullYear() - 10
    const birthDate = new Date(birthYear, today.getMonth(), today.getDate())
    const result = calculateAge(birthDate)
    expect(result).toBe('10 years old')
  })

  it("should handle age calculation when birthday hasn't occurred this year", () => {
    const today = new Date()
    const birthYear = today.getFullYear() - 10
    // Set birthday to next month
    const birthDate = new Date(birthYear, today.getMonth() + 1, today.getDate())
    const result = calculateAge(birthDate)
    expect(result).toBe('9 years old')
  })

  it('should format date string', () => {
    const today = new Date()
    const birthYear = today.getFullYear() - 5
    const birthDateStr = `${birthYear}-01-15`
    const result = calculateAge(birthDateStr)
    expect(result).toContain('years old')
  })

  it('should return "N/A" for null', () => {
    expect(calculateAge(null)).toBe('N/A')
  })

  it('should return "N/A" for undefined', () => {
    expect(calculateAge(undefined as unknown as null)).toBe('N/A')
  })

  it('should handle edge case of birthday today', () => {
    const today = new Date()
    const birthYear = today.getFullYear() - 8
    const birthDate = new Date(birthYear, today.getMonth(), today.getDate())
    const result = calculateAge(birthDate)
    expect(result).toBe('8 years old')
  })
})
