/**
 * Unit tests for DuplicateDetectionService
 *
 * Tests the core duplicate detection logic and the bug fix for
 * correctly identifying which field (email, phone, or both) caused a duplicate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { DatabaseClient } from '@/lib/db/types'

import { DuplicateDetectionService } from '../duplicate-detection-service'

// Mock the findPersonByContact query
vi.mock('@/lib/db/queries/program-profile', () => ({
  findPersonByContact: vi.fn(),
}))

// Mock the logger
vi.mock('@/lib/logger-client', () => ({
  createClientLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

const { findPersonByContact } = await import('@/lib/db/queries/program-profile')

// Type for mock person data used in tests
type MockPerson = Awaited<ReturnType<typeof findPersonByContact>>

describe('DuplicateDetectionService', () => {
  let mockClient: DatabaseClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = {} as DatabaseClient
  })

  describe('checkDuplicate', () => {
    it('should return no duplicate when neither email nor phone provided', async () => {
      const result = await DuplicateDetectionService.checkDuplicate(
        {
          program: 'MAHAD_PROGRAM',
        },
        mockClient
      )

      expect(result).toEqual({
        isDuplicate: false,
        duplicateField: null,
        existingPerson: null,
        hasActiveProfile: false,
      })

      expect(findPersonByContact).not.toHaveBeenCalled()
    })

    it('should return no duplicate when person not found', async () => {
      vi.mocked(findPersonByContact).mockResolvedValue(null)

      const result = await DuplicateDetectionService.checkDuplicate(
        {
          email: 'test@example.com',
          phone: '+1234567890',
          program: 'MAHAD_PROGRAM',
        },
        mockClient
      )

      expect(result).toEqual({
        isDuplicate: false,
        duplicateField: null,
        existingPerson: null,
        hasActiveProfile: false,
      })

      expect(findPersonByContact).toHaveBeenCalledWith(
        'test@example.com',
        '+1234567890',
        mockClient
      )
    })

    it('should detect duplicate when person found but has no active profile', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'EMAIL', value: 'test@example.com', isPrimary: true },
        ],
        programProfiles: [
          {
            id: 'profile-123',
            program: 'DUGSI_PROGRAM', // Different program
            enrollments: [],
          },
        ],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.checkDuplicate(
        {
          email: 'test@example.com',
          program: 'MAHAD_PROGRAM',
        },
        mockClient
      )

      expect(result.isDuplicate).toBe(true)
      expect(result.duplicateField).toBe('email')
      expect(result.hasActiveProfile).toBe(false) // No active Mahad profile
      expect(result.existingPerson).toEqual(mockPerson)
    })

    it('should detect duplicate with active profile', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'EMAIL', value: 'test@example.com', isPrimary: true },
        ],
        programProfiles: [
          {
            id: 'profile-123',
            program: 'MAHAD_PROGRAM',
            enrollments: [{ id: 'enrollment-123', status: 'ACTIVE' }],
          },
        ],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.checkDuplicate(
        {
          email: 'test@example.com',
          program: 'MAHAD_PROGRAM',
        },
        mockClient
      )

      expect(result.isDuplicate).toBe(true)
      expect(result.duplicateField).toBe('email')
      expect(result.hasActiveProfile).toBe(true)
      expect(result.activeProfile).toEqual({
        id: 'profile-123',
        program: 'MAHAD_PROGRAM',
        enrollmentCount: 1,
      })
    })

    it('should correctly identify email as duplicate field', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'EMAIL', value: 'test@example.com', isPrimary: true },
          { type: 'PHONE', value: '+9999999999', isPrimary: true }, // Different phone
        ],
        programProfiles: [
          {
            id: 'profile-123',
            program: 'MAHAD_PROGRAM',
            enrollments: [{ id: 'enrollment-123' }],
          },
        ],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.checkDuplicate(
        {
          email: 'test@example.com', // Matches
          phone: '+1234567890', // Does NOT match
          program: 'MAHAD_PROGRAM',
        },
        mockClient
      )

      expect(result.duplicateField).toBe('email') // Bug fix: Should be 'email', not hardcoded
    })

    it('should correctly identify phone as duplicate field', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'EMAIL', value: 'different@example.com', isPrimary: true }, // Different email
          { type: 'PHONE', value: '1234567890', isPrimary: true }, // Matches (stored normalized)
        ],
        programProfiles: [
          {
            id: 'profile-123',
            program: 'MAHAD_PROGRAM',
            enrollments: [{ id: 'enrollment-123' }],
          },
        ],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.checkDuplicate(
        {
          email: 'test@example.com', // Does NOT match
          phone: '+1234567890', // Matches
          program: 'MAHAD_PROGRAM',
        },
        mockClient
      )

      // THE BUG FIX: Should be 'phone', not 'email'
      expect(result.duplicateField).toBe('phone')
    })

    it('should correctly identify both email and phone as duplicate fields', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'EMAIL', value: 'test@example.com', isPrimary: true },
          { type: 'PHONE', value: '1234567890', isPrimary: true }, // Stored normalized
        ],
        programProfiles: [
          {
            id: 'profile-123',
            program: 'MAHAD_PROGRAM',
            enrollments: [{ id: 'enrollment-123' }],
          },
        ],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.checkDuplicate(
        {
          email: 'test@example.com', // Matches
          phone: '+1234567890', // Matches
          program: 'MAHAD_PROGRAM',
        },
        mockClient
      )

      expect(result.duplicateField).toBe('both')
    })

    it('should handle email case-insensitivity', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'EMAIL', value: 'test@example.com', isPrimary: true },
        ],
        programProfiles: [
          {
            id: 'profile-123',
            program: 'MAHAD_PROGRAM',
            enrollments: [{ id: 'enrollment-123' }],
          },
        ],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.checkDuplicate(
        {
          email: 'TEST@EXAMPLE.COM', // Different case
          program: 'MAHAD_PROGRAM',
        },
        mockClient
      )

      expect(result.duplicateField).toBe('email')
    })

    it('should handle WHATSAPP contact type as phone match', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'WHATSAPP', value: '1234567890', isPrimary: true }, // Stored normalized
        ],
        programProfiles: [
          {
            id: 'profile-123',
            program: 'MAHAD_PROGRAM',
            enrollments: [{ id: 'enrollment-123' }],
          },
        ],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.checkDuplicate(
        {
          phone: '+1234567890',
          program: 'MAHAD_PROGRAM',
        },
        mockClient
      )

      expect(result.duplicateField).toBe('phone')
    })

    it('should handle phone normalization when detecting duplicates', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'PHONE', value: '5551234567', isPrimary: true }, // Stored normalized (digits only)
        ],
        programProfiles: [
          {
            id: 'profile-123',
            program: 'MAHAD_PROGRAM',
            enrollments: [{ id: 'enrollment-123' }],
          },
        ],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.checkDuplicate(
        {
          phone: '(555) 123-4567', // Submitted with formatting
          program: 'MAHAD_PROGRAM',
        },
        mockClient
      )

      // Should match after normalization (bug fix verification)
      expect(result.duplicateField).toBe('phone')
      expect(result.isDuplicate).toBe(true)
    })
  })

  describe('isEmailRegistered', () => {
    it('should return true when email has active profile', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'EMAIL', value: 'test@example.com', isPrimary: true },
        ],
        programProfiles: [
          {
            id: 'profile-123',
            program: 'MAHAD_PROGRAM',
            enrollments: [{ id: 'enrollment-123' }],
          },
        ],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.isEmailRegistered(
        'test@example.com',
        'MAHAD_PROGRAM',
        mockClient
      )

      expect(result).toBe(true)
    })

    it('should return false when email has no active profile', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'EMAIL', value: 'test@example.com', isPrimary: true },
        ],
        programProfiles: [],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.isEmailRegistered(
        'test@example.com',
        'MAHAD_PROGRAM',
        mockClient
      )

      expect(result).toBe(false)
    })

    it('should return false when email not found', async () => {
      vi.mocked(findPersonByContact).mockResolvedValue(null)

      const result = await DuplicateDetectionService.isEmailRegistered(
        'test@example.com',
        'MAHAD_PROGRAM',
        mockClient
      )

      expect(result).toBe(false)
    })
  })

  describe('isPhoneRegistered', () => {
    it('should return true when phone has active profile', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'PHONE', value: '+1234567890', isPrimary: true },
        ],
        programProfiles: [
          {
            id: 'profile-123',
            program: 'MAHAD_PROGRAM',
            enrollments: [{ id: 'enrollment-123' }],
          },
        ],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.isPhoneRegistered(
        '+1234567890',
        'MAHAD_PROGRAM',
        mockClient
      )

      expect(result).toBe(true)
    })

    it('should return false when phone has no active profile', async () => {
      const mockPerson = {
        id: 'person-123',
        name: 'Test User',
        contactPoints: [
          { type: 'PHONE', value: '+1234567890', isPrimary: true },
        ],
        programProfiles: [],
      }

      vi.mocked(findPersonByContact).mockResolvedValue(mockPerson as MockPerson)

      const result = await DuplicateDetectionService.isPhoneRegistered(
        '+1234567890',
        'MAHAD_PROGRAM',
        mockClient
      )

      expect(result).toBe(false)
    })

    it('should return false when phone not found', async () => {
      vi.mocked(findPersonByContact).mockResolvedValue(null)

      const result = await DuplicateDetectionService.isPhoneRegistered(
        '+1234567890',
        'MAHAD_PROGRAM',
        mockClient
      )

      expect(result).toBe(false)
    })
  })
})
