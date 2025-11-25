/**
 * Shared Payment Service
 *
 * Cross-program payment processing operations.
 * Handles Stripe payment operations like bank verification,
 * payment method capture, and payment processing.
 *
 * Responsibilities:
 * - ACH bank account verification
 * - Payment method capture
 * - Payment processing
 * - Payment history
 */

import { StripeAccountType } from '@prisma/client'
import Stripe from 'stripe'

import { getStripeClient } from '@/lib/utils/stripe-client'

/**
 * Bank verification result
 */
export interface BankVerificationResult {
  paymentIntentId: string
  status: string
  verified: boolean
}

/**
 * Payment method capture result
 */
export interface PaymentMethodCaptureResult {
  customerId: string
  paymentMethodId: string
  captured: boolean
}

/**
 * Verify bank account using microdeposit descriptor code.
 *
 * This is used for ACH/bank account payments where Stripe sends
 * microdeposits with a descriptor code (e.g., "SM12AB").
 *
 * @param paymentIntentId - Stripe payment intent ID
 * @param descriptorCode - 6-character code from bank statement (e.g., "SMT86W")
 * @param accountType - Stripe account type
 * @returns Verification result
 * @throws Error if verification fails
 */
export async function verifyBankAccount(
  paymentIntentId: string,
  descriptorCode: string,
  accountType: StripeAccountType
): Promise<BankVerificationResult> {
  // Validate payment intent ID format
  if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
    throw new Error('Invalid payment intent ID format. Must start with "pi_"')
  }

  // Validate descriptor code format (6 characters, starts with SM)
  const cleanCode = descriptorCode.trim().toUpperCase()
  if (!/^SM[A-Z0-9]{4}$/.test(cleanCode)) {
    throw new Error(
      'Invalid descriptor code format. Must be 6 characters starting with SM (e.g., SMT86W)'
    )
  }

  // Get Stripe client
  const stripe = getStripeClient(accountType)

  try {
    // Call Stripe API to verify microdeposits
    const paymentIntent = await stripe.paymentIntents.verifyMicrodeposits(
      paymentIntentId,
      { descriptor_code: cleanCode }
    )

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      verified: paymentIntent.status === 'succeeded',
    }
  } catch (error) {
    // Handle specific Stripe errors
    if (error && typeof error === 'object' && 'code' in error) {
      const stripeError = error as { code?: string; message?: string }

      switch (stripeError.code) {
        case 'payment_intent_unexpected_state':
          throw new Error('This bank account has already been verified')
        case 'incorrect_code':
          throw new Error(
            'Incorrect verification code. Please check the code in the bank statement and try again'
          )
        case 'resource_missing':
          throw new Error(
            'Payment intent not found. The verification may have expired'
          )
        default:
          throw new Error(stripeError.message || 'Bank verification failed')
      }
    }

    throw error
  }
}

/**
 * Get bank verification status for a payment intent.
 *
 * @param paymentIntentId - Stripe payment intent ID
 * @param accountType - Stripe account type
 * @returns Payment intent with verification status
 */
export async function getBankVerificationStatus(
  paymentIntentId: string,
  accountType: StripeAccountType
): Promise<{ status: string; verified: boolean }> {
  const stripe = getStripeClient(accountType)

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  return {
    status: paymentIntent.status,
    verified: paymentIntent.status === 'succeeded',
  }
}

/**
 * Capture payment method from checkout session.
 *
 * Used when customer completes checkout and we need to save
 * their payment method for future charges.
 *
 * @param sessionId - Stripe checkout session ID
 * @param accountType - Stripe account type
 * @returns Capture result with customer and payment method IDs
 */
export async function capturePaymentMethodFromSession(
  sessionId: string,
  accountType: StripeAccountType
): Promise<PaymentMethodCaptureResult> {
  const stripe = getStripeClient(accountType)

  // Retrieve checkout session
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['customer', 'payment_intent'],
  })

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id

  if (!customerId) {
    throw new Error('No customer ID in checkout session')
  }

  // Get payment method from payment intent
  const paymentIntent = session.payment_intent
  const paymentMethodId =
    typeof paymentIntent === 'object' && paymentIntent
      ? typeof paymentIntent.payment_method === 'string'
        ? paymentIntent.payment_method
        : paymentIntent.payment_method?.id
      : null

  if (!paymentMethodId) {
    throw new Error('No payment method in checkout session')
  }

  return {
    customerId,
    paymentMethodId,
    captured: true,
  }
}

/**
 * Get payment method details.
 *
 * @param paymentMethodId - Stripe payment method ID
 * @param accountType - Stripe account type
 * @returns Payment method details
 */
export async function getPaymentMethodDetails(
  paymentMethodId: string,
  accountType: StripeAccountType
): Promise<Stripe.PaymentMethod> {
  const stripe = getStripeClient(accountType)

  return await stripe.paymentMethods.retrieve(paymentMethodId)
}
