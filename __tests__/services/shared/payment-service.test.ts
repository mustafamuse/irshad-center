/**
 * Payment Service Tests
 *
 * Tests for payment processing business logic.
 * Focus on validation logic, error handling, data extraction - not Stripe API calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  verifyBankAccount,
  getBankVerificationStatus,
  capturePaymentMethodFromSession,
} from '@/lib/services/shared/payment-service'

// Mock Stripe client
vi.mock('@/lib/utils/stripe-client', () => ({
  getStripeClient: vi.fn(() => ({
    paymentIntents: {
      verifyMicrodeposits: vi.fn(),
      retrieve: vi.fn(),
    },
    checkout: {
      sessions: {
        retrieve: vi.fn(),
      },
    },
  })),
}))

import { getStripeClient } from '@/lib/utils/stripe-client'

describe('PaymentService', () => {
  let mockStripe: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe = {
      paymentIntents: {
        verifyMicrodeposits: vi.fn(),
        retrieve: vi.fn(),
      },
      checkout: {
        sessions: {
          retrieve: vi.fn(),
        },
      },
    }
    vi.mocked(getStripeClient).mockReturnValue(mockStripe)
  })

  describe('verifyBankAccount - validation logic', () => {
    it('should throw error for invalid payment intent ID format', async () => {
      await expect(
        verifyBankAccount('invalid-id', 'SMT86W', 'MAHAD')
      ).rejects.toThrow('Invalid payment intent ID format')
    })

    it('should accept valid payment intent ID starting with pi_', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockResolvedValue({
        id: 'pi_123456',
        status: 'succeeded',
      })

      const result = await verifyBankAccount('pi_123456', 'SMT86W', 'MAHAD')

      expect(result.verified).toBe(true)
    })

    it('should normalize descriptor code to uppercase', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockResolvedValue({
        id: 'pi_123456',
        status: 'succeeded',
      })

      await verifyBankAccount('pi_123456', 'smt86w', 'MAHAD')

      expect(mockStripe.paymentIntents.verifyMicrodeposits).toHaveBeenCalledWith(
        'pi_123456',
        { descriptor_code: 'SMT86W' }
      )
    })

    it('should trim whitespace from descriptor code', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockResolvedValue({
        id: 'pi_123456',
        status: 'succeeded',
      })

      await verifyBankAccount('pi_123456', '  SMT86W  ', 'MAHAD')

      expect(mockStripe.paymentIntents.verifyMicrodeposits).toHaveBeenCalledWith(
        'pi_123456',
        { descriptor_code: 'SMT86W' }
      )
    })

    it('should throw error for invalid descriptor code format (too short)', async () => {
      await expect(
        verifyBankAccount('pi_123456', 'SM86W', 'MAHAD')
      ).rejects.toThrow('Invalid descriptor code format')
    })

    it('should throw error for invalid descriptor code format (too long)', async () => {
      await expect(
        verifyBankAccount('pi_123456', 'SMT86WX', 'MAHAD')
      ).rejects.toThrow('Invalid descriptor code format')
    })

    it('should throw error for descriptor code not starting with SM', async () => {
      await expect(
        verifyBankAccount('pi_123456', 'AB86WX', 'MAHAD')
      ).rejects.toThrow('Invalid descriptor code format')
    })

    it('should accept valid descriptor code format', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockResolvedValue({
        id: 'pi_123456',
        status: 'succeeded',
      })

      await verifyBankAccount('pi_123456', 'SMT86W', 'MAHAD')
      await verifyBankAccount('pi_123456', 'SM1234', 'MAHAD')
      await verifyBankAccount('pi_123456', 'SMABCD', 'MAHAD')

      expect(mockStripe.paymentIntents.verifyMicrodeposits).toHaveBeenCalledTimes(3)
    })

    it('should return verified:true when status is succeeded', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockResolvedValue({
        id: 'pi_123456',
        status: 'succeeded',
      })

      const result = await verifyBankAccount('pi_123456', 'SMT86W', 'MAHAD')

      expect(result.verified).toBe(true)
      expect(result.status).toBe('succeeded')
    })

    it('should return verified:false when status is not succeeded', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockResolvedValue({
        id: 'pi_123456',
        status: 'processing',
      })

      const result = await verifyBankAccount('pi_123456', 'SMT86W', 'MAHAD')

      expect(result.verified).toBe(false)
      expect(result.status).toBe('processing')
    })

    it('should handle payment_intent_unexpected_state error with custom message', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockRejectedValue({
        code: 'payment_intent_unexpected_state',
        message: 'Unexpected state',
      })

      await expect(
        verifyBankAccount('pi_123456', 'SMT86W', 'MAHAD')
      ).rejects.toThrow('This bank account has already been verified')
    })

    it('should handle incorrect_code error with custom message', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockRejectedValue({
        code: 'incorrect_code',
        message: 'Incorrect code',
      })

      await expect(
        verifyBankAccount('pi_123456', 'SMT86W', 'MAHAD')
      ).rejects.toThrow('Incorrect verification code')
    })

    it('should handle resource_missing error with custom message', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockRejectedValue({
        code: 'resource_missing',
        message: 'Not found',
      })

      await expect(
        verifyBankAccount('pi_123456', 'SMT86W', 'MAHAD')
      ).rejects.toThrow('Payment intent not found')
    })

    it('should use error message for unknown Stripe error codes', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockRejectedValue({
        code: 'unknown_error',
        message: 'Something went wrong',
      })

      await expect(
        verifyBankAccount('pi_123456', 'SMT86W', 'MAHAD')
      ).rejects.toThrow('Something went wrong')
    })

    it('should rethrow non-Stripe errors', async () => {
      const customError = new Error('Network error')
      mockStripe.paymentIntents.verifyMicrodeposits.mockRejectedValue(customError)

      await expect(
        verifyBankAccount('pi_123456', 'SMT86W', 'MAHAD')
      ).rejects.toThrow('Network error')
    })
  })

  describe('getBankVerificationStatus', () => {
    it('should return verified:true when status is succeeded', async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        status: 'succeeded',
      })

      const result = await getBankVerificationStatus('pi_123456', 'MAHAD')

      expect(result.verified).toBe(true)
      expect(result.status).toBe('succeeded')
    })

    it('should return verified:false when status is not succeeded', async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        status: 'requires_payment_method',
      })

      const result = await getBankVerificationStatus('pi_123456', 'MAHAD')

      expect(result.verified).toBe(false)
      expect(result.status).toBe('requires_payment_method')
    })
  })

  describe('capturePaymentMethodFromSession - data extraction', () => {
    it('should extract customer ID from string', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        customer: 'cus_123456',
        payment_intent: {
          payment_method: 'pm_123456',
        },
      })

      const result = await capturePaymentMethodFromSession('cs_123456', 'MAHAD')

      expect(result.customerId).toBe('cus_123456')
      expect(result.paymentMethodId).toBe('pm_123456')
      expect(result.captured).toBe(true)
    })

    it('should extract customer ID from object', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        customer: { id: 'cus_123456', name: 'John Doe' },
        payment_intent: {
          payment_method: 'pm_123456',
        },
      })

      const result = await capturePaymentMethodFromSession('cs_123456', 'MAHAD')

      expect(result.customerId).toBe('cus_123456')
    })

    it('should throw error if no customer ID in session', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        customer: null,
        payment_intent: {
          payment_method: 'pm_123456',
        },
      })

      await expect(
        capturePaymentMethodFromSession('cs_123456', 'MAHAD')
      ).rejects.toThrow('No customer ID in checkout session')
    })

    it('should extract payment method from payment intent string', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        customer: 'cus_123456',
        payment_intent: {
          payment_method: 'pm_123456',
        },
      })

      const result = await capturePaymentMethodFromSession('cs_123456', 'MAHAD')

      expect(result.paymentMethodId).toBe('pm_123456')
    })

    it('should extract payment method from payment intent object', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        customer: 'cus_123456',
        payment_intent: {
          payment_method: {
            id: 'pm_123456',
            type: 'card',
          },
        },
      })

      const result = await capturePaymentMethodFromSession('cs_123456', 'MAHAD')

      expect(result.paymentMethodId).toBe('pm_123456')
    })

    it('should throw error if no payment method in session', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        customer: 'cus_123456',
        payment_intent: null,
      })

      await expect(
        capturePaymentMethodFromSession('cs_123456', 'MAHAD')
      ).rejects.toThrow('No payment method in checkout session')
    })

    it('should throw error if payment intent has no payment method', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        customer: 'cus_123456',
        payment_intent: {
          payment_method: null,
        },
      })

      await expect(
        capturePaymentMethodFromSession('cs_123456', 'MAHAD')
      ).rejects.toThrow('No payment method in checkout session')
    })
  })
})
