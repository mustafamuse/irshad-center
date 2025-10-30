/**
 * Type Guards for Runtime Type Safety
 *
 * These type guards provide runtime type validation to ensure
 * data matches expected TypeScript interfaces.
 */

/**
 * Type guard for PaymentStatusData from getDugsiPaymentStatus action
 */
export interface PaymentStatusData {
  familyEmail: string
  studentCount: number
  hasPaymentMethod: boolean
  hasSubscription: boolean
  stripeCustomerId?: string | null
  subscriptionId?: string | null
  subscriptionStatus?: string | null
  paidUntil?: Date | string | null
  currentPeriodStart?: Date | string | null
  currentPeriodEnd?: Date | string | null
  students: Array<{ id: string; name: string }>
}

export function isPaymentStatusData(data: unknown): data is PaymentStatusData {
  if (!data || typeof data !== 'object') return false

  const obj = data as Record<string, unknown>

  // Check required fields
  if (typeof obj.familyEmail !== 'string') return false
  if (typeof obj.studentCount !== 'number') return false
  if (typeof obj.hasPaymentMethod !== 'boolean') return false
  if (typeof obj.hasSubscription !== 'boolean') return false

  // Check optional fields
  if (
    obj.stripeCustomerId !== undefined &&
    obj.stripeCustomerId !== null &&
    typeof obj.stripeCustomerId !== 'string'
  ) {
    return false
  }

  if (
    obj.subscriptionId !== undefined &&
    obj.subscriptionId !== null &&
    typeof obj.subscriptionId !== 'string'
  ) {
    return false
  }

  if (
    obj.subscriptionStatus !== undefined &&
    obj.subscriptionStatus !== null &&
    typeof obj.subscriptionStatus !== 'string'
  ) {
    return false
  }

  if (
    obj.paidUntil !== undefined &&
    obj.paidUntil !== null &&
    !(obj.paidUntil instanceof Date) &&
    typeof obj.paidUntil !== 'string'
  ) {
    return false
  }

  if (
    obj.currentPeriodStart !== undefined &&
    obj.currentPeriodStart !== null &&
    !(obj.currentPeriodStart instanceof Date) &&
    typeof obj.currentPeriodStart !== 'string'
  ) {
    return false
  }

  if (
    obj.currentPeriodEnd !== undefined &&
    obj.currentPeriodEnd !== null &&
    !(obj.currentPeriodEnd instanceof Date) &&
    typeof obj.currentPeriodEnd !== 'string'
  ) {
    return false
  }

  // Check students array
  if (!Array.isArray(obj.students)) return false

  return obj.students.every((student: unknown) => {
    if (!student || typeof student !== 'object') return false
    const s = student as Record<string, unknown>
    return typeof s.id === 'string' && typeof s.name === 'string'
  })
}

/**
 * Type guard for Stripe subscription status
 */
export const VALID_SUBSCRIPTION_STATUSES = [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
] as const

export type SubscriptionStatus = (typeof VALID_SUBSCRIPTION_STATUSES)[number]

export function isValidSubscriptionStatus(
  status: unknown
): status is SubscriptionStatus {
  return (
    typeof status === 'string' &&
    VALID_SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)
  )
}

/**
 * Type guard for Stripe customer ID or object
 */
export function extractCustomerId(customer: unknown): string | null {
  if (!customer) return null

  if (typeof customer === 'string') {
    return customer
  }

  if (typeof customer === 'object' && 'id' in customer) {
    const id = (customer as { id: unknown }).id
    return typeof id === 'string' ? id : null
  }

  return null
}

/**
 * Type guard for date fields that could be Date, string, or null
 */
export function parseDate(value: unknown): Date | null {
  if (!value) return null

  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'string') {
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'number') {
    // Assume Unix timestamp if it's a reasonable number
    const date = new Date(value * 1000)
    return isNaN(date.getTime()) ? null : date
  }

  return null
}

/**
 * Type guard for Stripe webhook event types
 */
export const HANDLED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const

export type HandledWebhookEvent = (typeof HANDLED_WEBHOOK_EVENTS)[number]

export function isHandledWebhookEvent(
  eventType: string
): eventType is HandledWebhookEvent {
  return HANDLED_WEBHOOK_EVENTS.includes(eventType as HandledWebhookEvent)
}

/**
 * Improved email validation using a more robust regex
 * Based on W3C HTML5 email validation spec
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false

  // More comprehensive email regex that handles edge cases
  // Matches the HTML5 email input validation
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  // Additional checks for common issues
  if (email.length > 320) return false // Max email length per RFC
  if (email.startsWith('.') || email.endsWith('.')) return false
  if (email.includes('..')) return false
  if (email.startsWith('@') || email.endsWith('@')) return false
  if (email.split('@').length !== 2) return false

  return emailRegex.test(email)
}

/**
 * Type guard for Stripe IDs (customer, subscription, etc.)
 */
export function isValidStripeId(id: unknown, prefix: string): id is string {
  if (typeof id !== 'string') return false
  return id.startsWith(prefix + '_')
}

/**
 * Safe extraction of subscription period end
 */
export function extractPeriodEnd(subscription: unknown): Date | undefined {
  if (!subscription || typeof subscription !== 'object') return undefined

  const sub = subscription as Record<string, unknown>
  const periodEnd = sub.current_period_end

  if (!periodEnd) return undefined

  if (typeof periodEnd === 'number') {
    // Stripe timestamps are in seconds, not milliseconds
    return new Date(periodEnd * 1000)
  }

  return undefined
}

/**
 * Safe extraction of subscription period start
 */
export function extractPeriodStart(subscription: unknown): Date | undefined {
  if (!subscription || typeof subscription !== 'object') return undefined

  const sub = subscription as Record<string, unknown>
  const periodStart = sub.current_period_start

  if (!periodStart) return undefined

  if (typeof periodStart === 'number') {
    // Stripe timestamps are in seconds, not milliseconds
    return new Date(periodStart * 1000)
  }

  return undefined
}

/**
 * Extract both period start and end from Stripe subscription
 */
export function extractPeriodDates(subscription: unknown): {
  periodStart: Date | undefined
  periodEnd: Date | undefined
} {
  return {
    periodStart: extractPeriodStart(subscription),
    periodEnd: extractPeriodEnd(subscription),
  }
}
