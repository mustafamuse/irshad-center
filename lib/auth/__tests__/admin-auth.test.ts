import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { generateAuthToken, verifyAuthToken } from '../admin-auth'

describe('admin-auth', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  describe('generateAuthToken', () => {
    it('throws when ADMIN_PIN is unset', () => {
      delete process.env.ADMIN_PIN

      expect(() => generateAuthToken()).toThrow(
        'ADMIN_PIN environment variable is not set'
      )
    })

    it('throws when ADMIN_PIN is empty string', () => {
      process.env.ADMIN_PIN = ''

      expect(() => generateAuthToken()).toThrow(
        'ADMIN_PIN environment variable is not set'
      )
    })

    it('returns timestamp.signature format when ADMIN_PIN is set', () => {
      process.env.ADMIN_PIN = 'test-pin-1234'

      const token = generateAuthToken()
      const parts = token.split('.')
      expect(parts).toHaveLength(2)
      expect(parts[0]).toMatch(/^\d+$/)
      expect(parts[1]).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('verifyAuthToken', () => {
    it('returns false when ADMIN_PIN is unset', () => {
      delete process.env.ADMIN_PIN

      expect(verifyAuthToken('1234567890.abcdef')).toBe(false)
    })

    it('returns false when ADMIN_PIN is empty string', () => {
      process.env.ADMIN_PIN = ''

      expect(verifyAuthToken('1234567890.abcdef')).toBe(false)
    })

    it('returns false for malformed token (no dot)', () => {
      process.env.ADMIN_PIN = 'test-pin-1234'

      expect(verifyAuthToken('notokenhere')).toBe(false)
    })

    it('returns false for expired token', () => {
      process.env.ADMIN_PIN = 'test-pin-1234'
      const oldTimestamp = (Date.now() - 25 * 60 * 60 * 1000).toString()

      expect(verifyAuthToken(`${oldTimestamp}.fakesig`)).toBe(false)
    })

    it('returns true for a valid token generated with the same PIN', () => {
      process.env.ADMIN_PIN = 'test-pin-1234'

      const token = generateAuthToken()
      expect(verifyAuthToken(token)).toBe(true)
    })

    it('returns false for a token generated with a different PIN', () => {
      process.env.ADMIN_PIN = 'pin-a'
      const token = generateAuthToken()

      process.env.ADMIN_PIN = 'pin-b'
      expect(verifyAuthToken(token)).toBe(false)
    })
  })
})
