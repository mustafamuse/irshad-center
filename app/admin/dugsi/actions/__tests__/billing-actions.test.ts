import { z } from 'zod'
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

vi.mock('@/lib/safe-action', () => {
  function makeClient() {
    const client = {
      metadata: () => client,
      use: () => client,
      schema: (schema: z.ZodType) => ({
        action:
          (handler: (args: { parsedInput: unknown }) => Promise<unknown>) =>
          async (input: unknown) => {
            const parsed = schema.safeParse(input)
            if (!parsed.success) {
              return { validationErrors: parsed.error.flatten().fieldErrors }
            }
            try {
              const data = await handler({ parsedInput: parsed.data })
              return { data }
            } catch (error) {
              const { ActionError } = await import('@/lib/errors/action-error')
              if (error instanceof ActionError)
                return { serverError: error.message }
              return { serverError: 'Something went wrong' }
            }
          },
      }),
    }
    return client
  }
  return { adminActionClient: makeClient() }
})

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
    expect(result?.validationErrors).toBeDefined()
    expect(mockPauseFamilyBilling).not.toHaveBeenCalled()
  })

  it('should return success on pause', async () => {
    mockPauseFamilyBilling.mockResolvedValueOnce({ success: true })

    const result = await pauseFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

    expect(result?.data?.message).toBe('Billing paused successfully')
    expect(result?.data?.warning).toBeUndefined()
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

    expect(result?.data?.warning).toContain('DB sync failed')
    expect(result?.data?.warning).toContain('DB connection lost')
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

    expect(result?.serverError).toBe(
      'No active subscription found for this family'
    )
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('should log and return error message for unexpected failures', async () => {
    mockPauseFamilyBilling.mockRejectedValueOnce(new Error('Stripe down'))

    const result = await pauseFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

    expect(result?.serverError).toBe('Stripe down')
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
    expect(result?.validationErrors).toBeDefined()
    expect(mockResumeFamilyBilling).not.toHaveBeenCalled()
  })

  it('should return success on resume', async () => {
    mockResumeFamilyBilling.mockResolvedValueOnce({ success: true })

    const result = await resumeFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

    expect(result?.data?.message).toBe('Billing resumed successfully')
    expect(result?.data?.warning).toBeUndefined()
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

    expect(result?.data?.warning).toContain('DB sync failed')
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

    expect(result?.serverError).toBe(
      'Cannot resume subscription with status "active"'
    )
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('should log and return error message for unexpected failures', async () => {
    mockResumeFamilyBilling.mockRejectedValueOnce(new Error('Network error'))

    const result = await resumeFamilyBillingAction({
      familyReferenceId: VALID_UUID,
    })

    expect(result?.serverError).toBe('Network error')
    expect(mockLogError).toHaveBeenCalled()
  })
})
