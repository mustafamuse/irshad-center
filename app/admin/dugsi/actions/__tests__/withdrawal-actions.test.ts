import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockWithdrawChild,
  mockReEnrollChild,
  mockWithdrawFamily,
  mockGetWithdrawPreview,
  mockGetWithdrawFamilyPreview,
  mockPauseFamilyBilling,
  mockResumeFamilyBilling,
  mockRevalidatePath,
  mockLogError,
} = vi.hoisted(() => ({
  mockWithdrawChild: vi.fn(),
  mockReEnrollChild: vi.fn(),
  mockWithdrawFamily: vi.fn(),
  mockGetWithdrawPreview: vi.fn(),
  mockGetWithdrawFamilyPreview: vi.fn(),
  mockPauseFamilyBilling: vi.fn(),
  mockResumeFamilyBilling: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('@/lib/services/dugsi', () => ({
  withdrawChild: (...args: unknown[]) => mockWithdrawChild(...args),
  reEnrollChild: (...args: unknown[]) => mockReEnrollChild(...args),
  withdrawFamily: (...args: unknown[]) => mockWithdrawFamily(...args),
  getWithdrawPreview: (...args: unknown[]) => mockGetWithdrawPreview(...args),
  getWithdrawFamilyPreview: (...args: unknown[]) =>
    mockGetWithdrawFamilyPreview(...args),
  pauseFamilyBilling: (...args: unknown[]) => mockPauseFamilyBilling(...args),
  resumeFamilyBilling: (...args: unknown[]) => mockResumeFamilyBilling(...args),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  logError: (...args: unknown[]) => mockLogError(...args),
}))

vi.mock('@/lib/errors/action-error', async () => {
  const actual = await vi.importActual('@/lib/errors/action-error')
  return actual
})

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'

import {
  withdrawChildAction,
  reEnrollChildAction,
  withdrawAllFamilyChildrenAction,
  pauseFamilyBillingAction,
  resumeFamilyBillingAction,
  getWithdrawChildPreviewAction,
  getWithdrawFamilyPreviewAction,
} from '../withdrawal-actions'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================================
// withdrawChildAction
// ============================================================================

describe('withdrawChildAction', () => {
  const validInput = {
    studentId: 'student-1',
    reason: 'family_moved',
    billingAdjustment: { type: 'auto_recalculate' },
  }

  it('should return validation error for invalid input', async () => {
    const result = await withdrawChildAction({})
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(mockWithdrawChild).not.toHaveBeenCalled()
  })

  it('should return success with message on successful withdrawal', async () => {
    mockWithdrawChild.mockResolvedValueOnce({
      withdrawn: true,
      billingUpdated: true,
    })

    const result = await withdrawChildAction(validInput)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Child withdrawn successfully')
    expect(result.warning).toBeUndefined()
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/dugsi')
  })

  it('should return warning when billing error occurs', async () => {
    mockWithdrawChild.mockResolvedValueOnce({
      withdrawn: true,
      billingUpdated: false,
      billingError: 'Stripe API error',
    })

    const result = await withdrawChildAction(validInput)

    expect(result.success).toBe(true)
    expect(result.warning).toContain('billing update failed')
    expect(result.warning).toContain('Stripe API error')
  })

  it('should return ActionError message without logging', async () => {
    mockWithdrawChild.mockRejectedValueOnce(
      new ActionError(
        'Student is already withdrawn',
        ERROR_CODES.ALREADY_WITHDRAWN
      )
    )

    const result = await withdrawChildAction(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Student is already withdrawn')
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('should log and return generic error for unexpected failures', async () => {
    mockWithdrawChild.mockRejectedValueOnce(new Error('DB connection lost'))

    const result = await withdrawChildAction(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('DB connection lost')
    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Error),
      'Failed to withdraw child',
      expect.objectContaining({ studentId: 'student-1' })
    )
  })
})

// ============================================================================
// reEnrollChildAction
// ============================================================================

describe('reEnrollChildAction', () => {
  const validInput = { studentId: 'student-1' }

  it('should return validation error for invalid input', async () => {
    const result = await reEnrollChildAction({})
    expect(result.success).toBe(false)
    expect(mockReEnrollChild).not.toHaveBeenCalled()
  })

  it('should return success on re-enrollment', async () => {
    mockReEnrollChild.mockResolvedValueOnce({
      reEnrolled: true,
      billingUpdated: true,
    })

    const result = await reEnrollChildAction(validInput)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Child re-enrolled successfully')
    expect(result.warning).toBeUndefined()
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/dugsi')
  })

  it('should return warning when billing error occurs', async () => {
    mockReEnrollChild.mockResolvedValueOnce({
      reEnrolled: true,
      billingUpdated: false,
      billingError: 'Stripe item not found',
    })

    const result = await reEnrollChildAction(validInput)

    expect(result.success).toBe(true)
    expect(result.warning).toContain('billing update failed')
  })

  it('should return ActionError message without logging', async () => {
    mockReEnrollChild.mockRejectedValueOnce(
      new ActionError('Student is not withdrawn', ERROR_CODES.NOT_WITHDRAWN)
    )

    const result = await reEnrollChildAction(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Student is not withdrawn')
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('should log and return generic error', async () => {
    mockReEnrollChild.mockRejectedValueOnce(new Error('Unexpected'))

    const result = await reEnrollChildAction(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unexpected')
    expect(mockLogError).toHaveBeenCalled()
  })
})

// ============================================================================
// withdrawAllFamilyChildrenAction
// ============================================================================

describe('withdrawAllFamilyChildrenAction', () => {
  const validInput = {
    familyReferenceId: VALID_UUID,
    reason: 'financial',
  }

  it('should return validation error for non-UUID familyReferenceId', async () => {
    const result = await withdrawAllFamilyChildrenAction({
      familyReferenceId: 'not-a-uuid',
      reason: 'financial',
    })
    expect(result.success).toBe(false)
    expect(mockWithdrawFamily).not.toHaveBeenCalled()
  })

  it('should return success with withdrawn count', async () => {
    mockWithdrawFamily.mockResolvedValueOnce({
      withdrawnCount: 3,
      billingCanceled: true,
    })

    const result = await withdrawAllFamilyChildrenAction(validInput)

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ withdrawnCount: 3 })
    expect(result.message).toBe('3 child(ren) withdrawn')
    expect(result.warning).toBeUndefined()
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/dugsi')
  })

  it('should return warning when billing error occurs', async () => {
    mockWithdrawFamily.mockResolvedValueOnce({
      withdrawnCount: 2,
      billingCanceled: false,
      billingError: 'Stripe cancel failed',
    })

    const result = await withdrawAllFamilyChildrenAction(validInput)

    expect(result.success).toBe(true)
    expect(result.warning).toContain('billing update failed')
    expect(result.warning).toContain('Stripe cancel failed')
  })

  it('should return ActionError message without logging', async () => {
    mockWithdrawFamily.mockRejectedValueOnce(
      new ActionError(
        'No active children to withdraw',
        ERROR_CODES.INVALID_INPUT
      )
    )

    const result = await withdrawAllFamilyChildrenAction(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('No active children to withdraw')
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('should log and return generic error', async () => {
    mockWithdrawFamily.mockRejectedValueOnce(new Error('DB timeout'))

    const result = await withdrawAllFamilyChildrenAction(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('DB timeout')
    expect(mockLogError).toHaveBeenCalled()
  })
})

// ============================================================================
// pauseFamilyBillingAction
// ============================================================================

describe('pauseFamilyBillingAction', () => {
  const validInput = { familyReferenceId: VALID_UUID }

  it('should return validation error for non-UUID', async () => {
    const result = await pauseFamilyBillingAction({
      familyReferenceId: 'bad',
    })
    expect(result.success).toBe(false)
    expect(mockPauseFamilyBilling).not.toHaveBeenCalled()
  })

  it('should return success on pause', async () => {
    mockPauseFamilyBilling.mockResolvedValueOnce({ success: true })

    const result = await pauseFamilyBillingAction(validInput)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Billing paused successfully')
    expect(result.warning).toBeUndefined()
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/dugsi')
  })

  it('should return warning when DB sync fails after Stripe pause', async () => {
    mockPauseFamilyBilling.mockResolvedValueOnce({
      success: false,
      error: 'DB connection lost',
    })

    const result = await pauseFamilyBillingAction(validInput)

    expect(result.success).toBe(true)
    expect(result.warning).toContain('DB sync failed')
    expect(result.warning).toContain('DB connection lost')
  })

  it('should return ActionError message without logging', async () => {
    mockPauseFamilyBilling.mockRejectedValueOnce(
      new ActionError(
        'No active subscription found for this family',
        ERROR_CODES.NO_ACTIVE_SUBSCRIPTION
      )
    )

    const result = await pauseFamilyBillingAction(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('No active subscription found for this family')
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('should log and return generic error', async () => {
    mockPauseFamilyBilling.mockRejectedValueOnce(new Error('Stripe down'))

    const result = await pauseFamilyBillingAction(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Stripe down')
    expect(mockLogError).toHaveBeenCalled()
  })
})

// ============================================================================
// resumeFamilyBillingAction
// ============================================================================

describe('resumeFamilyBillingAction', () => {
  const validInput = { familyReferenceId: VALID_UUID }

  it('should return validation error for non-UUID', async () => {
    const result = await resumeFamilyBillingAction({
      familyReferenceId: '',
    })
    expect(result.success).toBe(false)
    expect(mockResumeFamilyBilling).not.toHaveBeenCalled()
  })

  it('should return success on resume', async () => {
    mockResumeFamilyBilling.mockResolvedValueOnce({ success: true })

    const result = await resumeFamilyBillingAction(validInput)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Billing resumed successfully')
    expect(result.warning).toBeUndefined()
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/dugsi')
  })

  it('should return warning when DB sync fails after Stripe resume', async () => {
    mockResumeFamilyBilling.mockResolvedValueOnce({
      success: false,
      error: 'DB timeout',
    })

    const result = await resumeFamilyBillingAction(validInput)

    expect(result.success).toBe(true)
    expect(result.warning).toContain('DB sync failed')
  })

  it('should return ActionError message without logging', async () => {
    mockResumeFamilyBilling.mockRejectedValueOnce(
      new ActionError(
        'Cannot resume subscription with status "active"',
        ERROR_CODES.INVALID_INPUT
      )
    )

    const result = await resumeFamilyBillingAction(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Cannot resume subscription with status "active"')
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('should log and return generic error', async () => {
    mockResumeFamilyBilling.mockRejectedValueOnce(new Error('Network error'))

    const result = await resumeFamilyBillingAction(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
    expect(mockLogError).toHaveBeenCalled()
  })
})

// ============================================================================
// getWithdrawChildPreviewAction
// ============================================================================

describe('getWithdrawChildPreviewAction', () => {
  it('should return validation error for missing studentId', async () => {
    const result = await getWithdrawChildPreviewAction({})
    expect(result.success).toBe(false)
    expect(mockGetWithdrawPreview).not.toHaveBeenCalled()
  })

  it('should return preview data on success', async () => {
    const preview = {
      childName: 'Ali Hassan',
      activeChildrenCount: 3,
      currentAmount: 23000,
      recalculatedAmount: 16000,
      isLastActiveChild: false,
      hasActiveSubscription: true,
      isPaused: false,
    }
    mockGetWithdrawPreview.mockResolvedValueOnce(preview)

    const result = await getWithdrawChildPreviewAction({
      studentId: 'student-1',
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(preview)
  })

  it('should return error message on failure', async () => {
    mockGetWithdrawPreview.mockRejectedValueOnce(
      new ActionError('Student not found', ERROR_CODES.STUDENT_NOT_FOUND)
    )

    const result = await getWithdrawChildPreviewAction({
      studentId: 'bad-id',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Student not found')
  })

  it('should log and return generic error', async () => {
    mockGetWithdrawPreview.mockRejectedValueOnce(new Error('DB error'))

    const result = await getWithdrawChildPreviewAction({
      studentId: 'student-1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('DB error')
    expect(mockLogError).toHaveBeenCalled()
  })
})

// ============================================================================
// getWithdrawFamilyPreviewAction
// ============================================================================

describe('getWithdrawFamilyPreviewAction', () => {
  it('should return validation error for non-UUID', async () => {
    const result = await getWithdrawFamilyPreviewAction({
      familyReferenceId: 'not-uuid',
    })
    expect(result.success).toBe(false)
    expect(mockGetWithdrawFamilyPreview).not.toHaveBeenCalled()
  })

  it('should return preview data on success', async () => {
    const preview = {
      count: 2,
      students: [
        { id: 's1', name: 'Ali' },
        { id: 's2', name: 'Fatima' },
      ],
    }
    mockGetWithdrawFamilyPreview.mockResolvedValueOnce(preview)

    const result = await getWithdrawFamilyPreviewAction({
      familyReferenceId: VALID_UUID,
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(preview)
  })

  it('should return error message on failure', async () => {
    mockGetWithdrawFamilyPreview.mockRejectedValueOnce(new Error('Not found'))

    const result = await getWithdrawFamilyPreviewAction({
      familyReferenceId: VALID_UUID,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Not found')
    expect(mockLogError).toHaveBeenCalled()
  })
})
