import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPauseFamilyBilling,
  mockResumeFamilyBilling,
  mockRevalidatePath,
  mockLogError,
} = vi.hoisted(() => ({
  mockPauseFamilyBilling: vi.fn(),
  mockResumeFamilyBilling: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('@/lib/services/dugsi', () => ({
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
  pauseFamilyBillingAction,
  resumeFamilyBillingAction,
} from '../billing-actions'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================================
// pauseFamilyBillingAction
// ============================================================================

describe('pauseFamilyBillingAction', () => {
  it('should return validation error for non-UUID', async () => {
    const result = await pauseFamilyBillingAction({
      familyReferenceId: 'bad',
    })
    expect(result.success).toBe(false)
    expect(mockPauseFamilyBilling).not.toHaveBeenCalled()
  })

  it('should return validation error for missing input', async () => {
    const result = await pauseFamilyBillingAction({})
    expect(result.success).toBe(false)
  })

  it('should return success on pause', async () => {
    mockPauseFamilyBilling.mockResolvedValueOnce({ success: true })

    const result = await pauseFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

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

    const result = await pauseFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

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

    const result = await pauseFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('No active subscription found for this family')
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('should log and return generic error for unexpected failures', async () => {
    mockPauseFamilyBilling.mockRejectedValueOnce(new Error('Stripe down'))

    const result = await pauseFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Stripe down')
    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Error),
      'Failed to pause billing',
      expect.objectContaining({ familyReferenceId: VALID_UUID })
    )
  })
})

// ============================================================================
// resumeFamilyBillingAction
// ============================================================================

describe('resumeFamilyBillingAction', () => {
  it('should return validation error for non-UUID', async () => {
    const result = await resumeFamilyBillingAction({
      familyReferenceId: '',
    })
    expect(result.success).toBe(false)
    expect(mockResumeFamilyBilling).not.toHaveBeenCalled()
  })

  it('should return success on resume', async () => {
    mockResumeFamilyBilling.mockResolvedValueOnce({ success: true })

    const result = await resumeFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

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

    const result = await resumeFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

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

    const result = await resumeFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Cannot resume subscription with status "active"')
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('should log and return generic error for unexpected failures', async () => {
    mockResumeFamilyBilling.mockRejectedValueOnce(new Error('Network error'))

    const result = await resumeFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
    expect(mockLogError).toHaveBeenCalled()
  })
})
