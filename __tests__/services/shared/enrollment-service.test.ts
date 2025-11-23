/**
 * Enrollment Service Tests
 *
 * Tests for cross-program enrollment status management.
 * Focus on business logic: subscription cancellation handling, enrollment status updates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { handleSubscriptionCancellationEnrollments } from '@/lib/services/shared/enrollment-service'

// Mock the query dependencies
vi.mock('@/lib/db/queries/enrollment', () => ({
  getActiveEnrollment: vi.fn(),
  updateEnrollmentStatus: vi.fn(),
}))

vi.mock('@/lib/services/webhooks/webhook-service', () => ({
  getSubscriptionAssignments: vi.fn(),
}))

import { getActiveEnrollment, updateEnrollmentStatus } from '@/lib/db/queries/enrollment'
import { getSubscriptionAssignments } from '@/lib/services/webhooks/webhook-service'

describe('EnrollmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleSubscriptionCancellationEnrollments', () => {
    it('should withdraw enrollments for all active assignments', async () => {
      const subscriptionId = 'sub_123'
      const assignments = [
        {
          id: 'assignment-1',
          programProfileId: 'profile-1',
          isActive: true,
        },
        {
          id: 'assignment-2',
          programProfileId: 'profile-2',
          isActive: true,
        },
      ]

      vi.mocked(getSubscriptionAssignments).mockResolvedValue(assignments as any)
      vi.mocked(getActiveEnrollment).mockResolvedValueOnce({
        id: 'enrollment-1',
      } as any)
      vi.mocked(getActiveEnrollment).mockResolvedValueOnce({
        id: 'enrollment-2',
      } as any)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue(undefined as any)

      const result = await handleSubscriptionCancellationEnrollments(subscriptionId)

      expect(result.withdrawn).toBe(2)
      expect(result.errors).toHaveLength(0)
      expect(updateEnrollmentStatus).toHaveBeenCalledTimes(2)
      expect(updateEnrollmentStatus).toHaveBeenCalledWith(
        'enrollment-1',
        'WITHDRAWN',
        'Subscription canceled',
        expect.any(Date)
      )
    })

    it('should skip inactive assignments', async () => {
      const subscriptionId = 'sub_123'
      const assignments = [
        {
          id: 'assignment-1',
          programProfileId: 'profile-1',
          isActive: true,
        },
        {
          id: 'assignment-2',
          programProfileId: 'profile-2',
          isActive: false, // Inactive
        },
      ]

      vi.mocked(getSubscriptionAssignments).mockResolvedValue(assignments as any)
      vi.mocked(getActiveEnrollment).mockResolvedValue({
        id: 'enrollment-1',
      } as any)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue(undefined as any)

      const result = await handleSubscriptionCancellationEnrollments(subscriptionId)

      expect(result.withdrawn).toBe(1)
      expect(updateEnrollmentStatus).toHaveBeenCalledTimes(1)
    })

    it('should skip assignments without active enrollment', async () => {
      const subscriptionId = 'sub_123'
      const assignments = [
        {
          id: 'assignment-1',
          programProfileId: 'profile-1',
          isActive: true,
        },
        {
          id: 'assignment-2',
          programProfileId: 'profile-2',
          isActive: true,
        },
      ]

      vi.mocked(getSubscriptionAssignments).mockResolvedValue(assignments as any)
      vi.mocked(getActiveEnrollment).mockResolvedValueOnce({
        id: 'enrollment-1',
      } as any)
      vi.mocked(getActiveEnrollment).mockResolvedValueOnce(null) // No active enrollment
      vi.mocked(updateEnrollmentStatus).mockResolvedValue(undefined as any)

      const result = await handleSubscriptionCancellationEnrollments(subscriptionId)

      expect(result.withdrawn).toBe(1)
      expect(updateEnrollmentStatus).toHaveBeenCalledTimes(1)
    })

    it('should use custom reason if provided', async () => {
      const subscriptionId = 'sub_123'
      const assignments = [
        {
          id: 'assignment-1',
          programProfileId: 'profile-1',
          isActive: true,
        },
      ]

      vi.mocked(getSubscriptionAssignments).mockResolvedValue(assignments as any)
      vi.mocked(getActiveEnrollment).mockResolvedValue({
        id: 'enrollment-1',
      } as any)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue(undefined as any)

      await handleSubscriptionCancellationEnrollments(
        subscriptionId,
        'Payment failed'
      )

      expect(updateEnrollmentStatus).toHaveBeenCalledWith(
        'enrollment-1',
        'WITHDRAWN',
        'Payment failed',
        expect.any(Date)
      )
    })

    it('should collect errors for failed updates', async () => {
      const subscriptionId = 'sub_123'
      const assignments = [
        {
          id: 'assignment-1',
          programProfileId: 'profile-1',
          isActive: true,
        },
        {
          id: 'assignment-2',
          programProfileId: 'profile-2',
          isActive: true,
        },
      ]

      vi.mocked(getSubscriptionAssignments).mockResolvedValue(assignments as any)
      vi.mocked(getActiveEnrollment).mockResolvedValueOnce({
        id: 'enrollment-1',
      } as any)
      vi.mocked(getActiveEnrollment).mockResolvedValueOnce({
        id: 'enrollment-2',
      } as any)

      // First update succeeds, second fails
      vi.mocked(updateEnrollmentStatus)
        .mockResolvedValueOnce(undefined as any)
        .mockRejectedValueOnce(new Error('Database error'))

      const result = await handleSubscriptionCancellationEnrollments(subscriptionId)

      expect(result.withdrawn).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toEqual({
        profileId: 'profile-2',
        error: 'Database error',
      })
    })

    it('should handle all assignments failing gracefully', async () => {
      const subscriptionId = 'sub_123'
      const assignments = [
        {
          id: 'assignment-1',
          programProfileId: 'profile-1',
          isActive: true,
        },
        {
          id: 'assignment-2',
          programProfileId: 'profile-2',
          isActive: true,
        },
      ]

      vi.mocked(getSubscriptionAssignments).mockResolvedValue(assignments as any)
      vi.mocked(getActiveEnrollment).mockResolvedValue({
        id: 'enrollment-1',
      } as any)
      vi.mocked(updateEnrollmentStatus).mockRejectedValue(
        new Error('Database error')
      )

      const result = await handleSubscriptionCancellationEnrollments(subscriptionId)

      expect(result.withdrawn).toBe(0)
      expect(result.errors).toHaveLength(2)
    })

    it('should handle subscription with no assignments', async () => {
      const subscriptionId = 'sub_123'

      vi.mocked(getSubscriptionAssignments).mockResolvedValue([])

      const result = await handleSubscriptionCancellationEnrollments(subscriptionId)

      expect(result.withdrawn).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(getActiveEnrollment).not.toHaveBeenCalled()
      expect(updateEnrollmentStatus).not.toHaveBeenCalled()
    })

    it('should handle non-Error rejections', async () => {
      const subscriptionId = 'sub_123'
      const assignments = [
        {
          id: 'assignment-1',
          programProfileId: 'profile-1',
          isActive: true,
        },
      ]

      vi.mocked(getSubscriptionAssignments).mockResolvedValue(assignments as any)
      vi.mocked(getActiveEnrollment).mockResolvedValue({
        id: 'enrollment-1',
      } as any)
      vi.mocked(updateEnrollmentStatus).mockRejectedValue('String error')

      const result = await handleSubscriptionCancellationEnrollments(subscriptionId)

      expect(result.errors[0].error).toBe('String error')
    })
  })
})
