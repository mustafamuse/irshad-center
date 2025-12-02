/**
 * Dugsi Registration Service Tests
 *
 * Tests for deleteDugsiFamily and cancelFamilySubscriptions functions.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetProgramProfileById,
  mockGetProgramProfilesByFamilyId,
  mockPrismaDelete,
  mockPrismaDeleteMany,
  mockCancelSubscription,
  mockLogWarning,
} = vi.hoisted(() => ({
  mockGetProgramProfileById: vi.fn(),
  mockGetProgramProfilesByFamilyId: vi.fn(),
  mockPrismaDelete: vi.fn(),
  mockPrismaDeleteMany: vi.fn(),
  mockCancelSubscription: vi.fn(),
  mockLogWarning: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      delete: (...args: unknown[]) => mockPrismaDelete(...args),
      deleteMany: (...args: unknown[]) => mockPrismaDeleteMany(...args),
    },
  },
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfileById: (...args: unknown[]) =>
    mockGetProgramProfileById(...args),
  getProgramProfilesByFamilyId: (...args: unknown[]) =>
    mockGetProgramProfilesByFamilyId(...args),
}))

vi.mock('@/lib/services/shared/subscription-service', () => ({
  cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logWarning: (...args: unknown[]) => mockLogWarning(...args),
}))

import { deleteDugsiFamily } from '../registration-service'

describe('deleteDugsiFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrismaDelete.mockResolvedValue({})
    mockPrismaDeleteMany.mockResolvedValue({ count: 1 })
  })

  describe('single student without family', () => {
    it('should delete single student without familyReferenceId', async () => {
      const singleProfile = {
        id: 'profile-1',
        program: 'DUGSI_PROGRAM',
        familyReferenceId: null,
        assignments: [],
      }

      mockGetProgramProfileById.mockResolvedValue(singleProfile)

      const result = await deleteDugsiFamily('profile-1')

      expect(mockPrismaDelete).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
      })
      expect(result).toEqual({
        studentsDeleted: 1,
        subscriptionsCanceled: 0,
      })
    })

    it('should cancel subscription for single student with active subscription', async () => {
      const singleProfile = {
        id: 'profile-1',
        program: 'DUGSI_PROGRAM',
        familyReferenceId: null,
        assignments: [
          {
            subscription: {
              status: 'active',
              stripeSubscriptionId: 'sub_123',
            },
          },
        ],
      }

      mockGetProgramProfileById.mockResolvedValue(singleProfile)
      mockCancelSubscription.mockResolvedValue({})

      const result = await deleteDugsiFamily('profile-1')

      expect(mockCancelSubscription).toHaveBeenCalledWith(
        'sub_123',
        true,
        'DUGSI'
      )
      expect(result).toEqual({
        studentsDeleted: 1,
        subscriptionsCanceled: 1,
      })
    })
  })

  describe('family with multiple students', () => {
    it('should delete all students in family', async () => {
      const familyProfile = {
        id: 'profile-1',
        program: 'DUGSI_PROGRAM',
        familyReferenceId: 'family-123',
        assignments: [],
      }

      const familyProfiles = [
        { id: 'profile-1', familyReferenceId: 'family-123', assignments: [] },
        { id: 'profile-2', familyReferenceId: 'family-123', assignments: [] },
        { id: 'profile-3', familyReferenceId: 'family-123', assignments: [] },
      ]

      mockGetProgramProfileById.mockResolvedValue(familyProfile)
      mockGetProgramProfilesByFamilyId.mockResolvedValue(familyProfiles)
      mockPrismaDeleteMany.mockResolvedValue({ count: 3 })

      const result = await deleteDugsiFamily('profile-1')

      expect(mockPrismaDeleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['profile-1', 'profile-2', 'profile-3'] },
        },
      })
      expect(result).toEqual({
        studentsDeleted: 3,
        subscriptionsCanceled: 0,
      })
    })

    it('should cancel shared family subscription once', async () => {
      const familyProfile = {
        id: 'profile-1',
        program: 'DUGSI_PROGRAM',
        familyReferenceId: 'family-123',
        assignments: [
          {
            subscription: {
              status: 'active',
              stripeSubscriptionId: 'sub_shared',
            },
          },
        ],
      }

      const familyProfiles = [
        {
          id: 'profile-1',
          familyReferenceId: 'family-123',
          assignments: [
            {
              subscription: {
                status: 'active',
                stripeSubscriptionId: 'sub_shared',
              },
            },
          ],
        },
        {
          id: 'profile-2',
          familyReferenceId: 'family-123',
          assignments: [
            {
              subscription: {
                status: 'active',
                stripeSubscriptionId: 'sub_shared',
              },
            },
          ],
        },
      ]

      mockGetProgramProfileById.mockResolvedValue(familyProfile)
      mockGetProgramProfilesByFamilyId.mockResolvedValue(familyProfiles)
      mockCancelSubscription.mockResolvedValue({})

      const result = await deleteDugsiFamily('profile-1')

      expect(mockCancelSubscription).toHaveBeenCalledTimes(1)
      expect(mockCancelSubscription).toHaveBeenCalledWith(
        'sub_shared',
        true,
        'DUGSI'
      )
      expect(result).toEqual({
        studentsDeleted: 2,
        subscriptionsCanceled: 1,
      })
    })
  })

  describe('subscription cancellation edge cases', () => {
    it('should skip already canceled subscriptions', async () => {
      const profile = {
        id: 'profile-1',
        program: 'DUGSI_PROGRAM',
        familyReferenceId: null,
        assignments: [
          {
            subscription: {
              status: 'canceled',
              stripeSubscriptionId: 'sub_old',
            },
          },
        ],
      }

      mockGetProgramProfileById.mockResolvedValue(profile)

      const result = await deleteDugsiFamily('profile-1')

      expect(mockCancelSubscription).not.toHaveBeenCalled()
      expect(result).toEqual({
        studentsDeleted: 1,
        subscriptionsCanceled: 0,
      })
    })

    it('should continue deletion even when Stripe cancellation fails', async () => {
      const profile = {
        id: 'profile-1',
        program: 'DUGSI_PROGRAM',
        familyReferenceId: null,
        assignments: [
          {
            subscription: {
              status: 'active',
              stripeSubscriptionId: 'sub_error',
            },
          },
        ],
      }

      mockGetProgramProfileById.mockResolvedValue(profile)
      mockCancelSubscription.mockRejectedValue(
        new Error('Stripe API error: subscription already canceled')
      )

      const result = await deleteDugsiFamily('profile-1')

      expect(mockLogWarning).toHaveBeenCalledWith(
        expect.anything(),
        'Subscription cancellation failed during family deletion',
        expect.objectContaining({
          stripeSubscriptionId: 'sub_error',
          error: 'Stripe API error: subscription already canceled',
        })
      )
      expect(mockPrismaDelete).toHaveBeenCalled()
      expect(result).toEqual({
        studentsDeleted: 1,
        subscriptionsCanceled: 0,
      })
    })
  })

  describe('error handling', () => {
    it('should throw error when student not found', async () => {
      mockGetProgramProfileById.mockResolvedValue(null)

      await expect(deleteDugsiFamily('non-existent')).rejects.toMatchObject({
        message: 'Student not found or not in Dugsi program',
      })
    })

    it('should throw error when profile is not Dugsi program', async () => {
      mockGetProgramProfileById.mockResolvedValue({
        id: 'profile-1',
        program: 'MAHAD_PROGRAM',
      })

      await expect(deleteDugsiFamily('profile-1')).rejects.toMatchObject({
        message: 'Student not found or not in Dugsi program',
      })
    })
  })
})
