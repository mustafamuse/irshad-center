/**
 * Custom error classes for webhook handling
 */

/**
 * RetryableWebhookError - For expected race conditions that should be retried
 *
 * Use this when a webhook arrives out of order (e.g., subscription.updated
 * before subscription.created). This triggers:
 * - WebhookEvent cleanup (allows retry)
 * - 500 response (Stripe retries)
 * - Warning-level logging (not error, since it's expected)
 */
export class RetryableWebhookError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'RetryableWebhookError'
  }
}

/**
 * Helper to create a retryable error for missing subscription
 */
export function subscriptionNotFoundForRetry(stripeSubscriptionId: string) {
  return new RetryableWebhookError(
    `Subscription ${stripeSubscriptionId} not found - may arrive in subsequent webhook`,
    { stripeSubscriptionId }
  )
}

/**
 * RateMismatchError - For billing rate discrepancies that require investigation
 *
 * Use this when Stripe subscription amount doesn't match our calculated rate.
 * This triggers:
 * - 400 response (Stripe does NOT retry - issue requires manual investigation)
 * - Error-level logging with rate details
 */
export class RateMismatchError extends Error {
  constructor(
    message: string,
    public readonly context: {
      subscriptionId: string
      stripeAmount: number | null | undefined
      expectedRate: number
      [key: string]: unknown
    }
  ) {
    super(message)
    this.name = 'RateMismatchError'
  }
}
