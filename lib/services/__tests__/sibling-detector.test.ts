import { describe, it, expect, beforeEach, vi } from 'vitest'
import { detectPotentialSiblings, calculateConfidenceScore } from '../sibling-detector'
import type { DetectionMethod } from '../sibling-detector'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      findUnique: vi.fn(),
    },
    guardianRelationship: {
      findMany: vi.fn(),
    },
    contactPoint: {
      findMany: vi.fn(),
    },
    siblingRelationship: {
      findFirst: vi.fn(),
    },
  },
}))

describe('sibling-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateConfidenceScore', () => {
    it('should return 1.0 for MANUAL method', () => {
      const score = calculateConfidenceScore('MANUAL', {})
      expect(score).toBe(1.0)
    })

    it('should return high confidence for GUARDIAN_MATCH', () => {
      const score = calculateConfidenceScore('GUARDIAN_MATCH', {
        sharedGuardians: 1,
      })
      expect(score).toBe(0.9)
    })

    it('should return higher confidence for multiple shared guardians', () => {
      const score = calculateConfidenceScore('GUARDIAN_MATCH', {
        sharedGuardians: 2,
      })
      expect(score).toBe(0.95)
    })

    it('should return moderate confidence for CONTACT_MATCH', () => {
      const score = calculateConfidenceScore('CONTACT_MATCH', {
        sharedContacts: 1,
      })
      expect(score).toBe(0.8)
    })

    it('should return lower confidence for NAME_MATCH', () => {
      const score = calculateConfidenceScore('NAME_MATCH', {
        nameMatch: true,
      })
      expect(score).toBe(0.6)
    })

    it('should increase confidence for similar ages', () => {
      const score = calculateConfidenceScore('NAME_MATCH', {
        nameMatch: true,
        ageSimilarity: 2,
      })
      expect(score).toBe(0.8)
    })
  })
})

