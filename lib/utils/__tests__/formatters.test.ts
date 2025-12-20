/**
 * Formatters Tests
 *
 * Tests for formatting utility functions
 */

import { describe, it, expect } from 'vitest'

import { formatFullName } from '../formatters'

describe('formatFullName', () => {
  it('should format both first and last names', () => {
    expect(formatFullName('John', 'Doe')).toBe('John Doe')
  })

  it('should handle only first name', () => {
    expect(formatFullName('John', null)).toBe('John')
  })

  it('should handle only last name', () => {
    expect(formatFullName(null, 'Doe')).toBe('Doe')
  })

  it('should return empty string when both names are null and no fallback', () => {
    expect(formatFullName(null, null)).toBe('')
  })

  it('should return fallback when both names are null', () => {
    expect(formatFullName(null, null, 'Parent')).toBe('Parent')
  })

  it('should return fallback when both names are empty strings', () => {
    expect(formatFullName('', '', 'Not provided')).toBe('Not provided')
  })

  it('should handle names with multiple spaces', () => {
    expect(formatFullName('John Paul', 'Smith Jones')).toBe(
      'John Paul Smith Jones'
    )
  })

  it('should handle names with special characters', () => {
    expect(formatFullName("O'Brien", 'McDonald')).toBe("O'Brien McDonald")
  })

  it('should preserve whitespace in names', () => {
    expect(formatFullName('  John  ', '  Doe  ')).toBe('  John     Doe  ')
  })

  it('should handle empty first name with valid last name', () => {
    expect(formatFullName('', 'Doe')).toBe('Doe')
  })

  it('should handle valid first name with empty last name', () => {
    expect(formatFullName('John', '')).toBe('John')
  })

  it('should use custom fallback for UI context', () => {
    expect(formatFullName(null, null, 'Not provided')).toBe('Not provided')
  })

  it('should use empty string fallback for CSV context', () => {
    expect(formatFullName(null, null, '')).toBe('')
  })

  it('should handle names with hyphens', () => {
    expect(formatFullName('Jean-Pierre', 'Dubois-Martin')).toBe(
      'Jean-Pierre Dubois-Martin'
    )
  })

  it('should preserve case', () => {
    expect(formatFullName('JOHN', 'DOE')).toBe('JOHN DOE')
    expect(formatFullName('john', 'doe')).toBe('john doe')
  })
})
