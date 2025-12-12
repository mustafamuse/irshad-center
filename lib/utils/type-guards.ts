/**
 * Type Guards for Runtime Type Safety
 *
 * These type guards provide runtime type validation to ensure
 * data matches expected TypeScript interfaces.
 */

import { Prisma } from '@prisma/client'

import { STRIPE_WEBHOOK_EVENTS } from '@/lib/constants/stripe'

export const PRISMA_ERRORS = {
  UNIQUE_CONSTRAINT: 'P2002',
  RECORD_NOT_FOUND: 'P2025',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
} as const

export function isPrismaError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
}

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
  paidUntil?: Date | null
  currentPeriodStart?: Date | null
  currentPeriodEnd?: Date | null
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
    !(obj.paidUntil instanceof Date)
  ) {
    return false
  }

  if (
    obj.currentPeriodStart !== undefined &&
    obj.currentPeriodStart !== null &&
    !(obj.currentPeriodStart instanceof Date)
  ) {
    return false
  }

  if (
    obj.currentPeriodEnd !== undefined &&
    obj.currentPeriodEnd !== null &&
    !(obj.currentPeriodEnd instanceof Date)
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
  STRIPE_WEBHOOK_EVENTS.CHECKOUT_COMPLETED,
  STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED,
  STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED,
  STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED,
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
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

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
 * Returns null instead of undefined for consistency with Prisma types
 */
export function extractPeriodEnd(subscription: unknown): Date | null {
  if (!subscription || typeof subscription !== 'object') return null

  const sub = subscription as Record<string, unknown>
  const periodEnd = sub.current_period_end

  if (!periodEnd) return null

  if (typeof periodEnd === 'number') {
    // Stripe timestamps are in seconds, not milliseconds
    return new Date(periodEnd * 1000)
  }

  return null
}

/**
 * Safe extraction of subscription period start
 * Returns null instead of undefined for consistency with Prisma types
 */
export function extractPeriodStart(subscription: unknown): Date | null {
  if (!subscription || typeof subscription !== 'object') return null

  const sub = subscription as Record<string, unknown>
  const periodStart = sub.current_period_start

  if (!periodStart) return null

  if (typeof periodStart === 'number') {
    // Stripe timestamps are in seconds, not milliseconds
    return new Date(periodStart * 1000)
  }

  return null
}

/**
 * Extract both period start and end from Stripe subscription
 * Returns null for missing values for consistency with Prisma DateTime? types
 */
export function extractPeriodDates(subscription: unknown): {
  periodStart: Date | null
  periodEnd: Date | null
} {
  return {
    periodStart: extractPeriodStart(subscription),
    periodEnd: extractPeriodEnd(subscription),
  }
}

/**
 * Type guard for Prisma errors
 * Checks if an error is a Prisma client error with an error code
 */
export interface PrismaError extends Error {
  code: string
  meta?: Record<string, unknown>
}

export function isPrismaError(error: unknown): error is PrismaError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as PrismaError).code === 'string'
  )
}
