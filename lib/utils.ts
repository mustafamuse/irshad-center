// Browser-safe enum definition (Prisma Client cannot be used in browser)
// This matches the SubscriptionStatus enum from Prisma schema
const SubscriptionStatus = {
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'unpaid',
  paused: 'paused',
} as const

type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { LogEventData } from '@/app/api/webhook/types'
import { BatchStudentData } from '@/lib/types/batch'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateTotal(students: BatchStudentData[]): number {
  return students.reduce(
    (total, student) => total + (student.monthlyRate ?? 0),
    0
  )
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export const formatDiscountType = (type: string, amount: number) => {
  if (type === 'Family Discount') {
    return `Fam ($${amount} off)`
  }
  return type
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
export function getBillingCycleAnchor(dayOfMonth: number = 1): number {
  // Get the current date and move to the next month
  const targetDate = new Date()
  targetDate.setMonth(targetDate.getMonth() + 1)

  // Set the desired day of the month (default to 1st if no day is provided)
  targetDate.setDate(dayOfMonth)

  // Reset the time to midnight
  targetDate.setHours(0, 0, 0, 0)

  // Return Unix timestamp
  return Math.floor(targetDate.getTime() / 1000)
}

/**
 * Logs an event with structured data
 * @param message - The log message
 * @param eventId - The ID of the event (e.g. Stripe event ID)
 * @param data - Structured data about the event
 * @deprecated Use createWebhookLogger() directly instead - keeping console for backward compatibility
 */
export function logEvent(
  message: string,
  eventId: string,
  data: LogEventData
): void {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`, {
    ...data,
  })
}

// Utility: Handle errors gracefully
/**
 * @deprecated Use logError() from logger instead - keeping console for backward compatibility
 */
export function handleError(action: string, eventId: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  console.error(`[${action}] Error: ${eventId}`, {
    errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
  })
  throw error // Re-throw to ensure Stripe retries the webhook if needed
}

export function getStatusColor(status: SubscriptionStatus) {
  switch (status) {
    case SubscriptionStatus.active:
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
    case SubscriptionStatus.past_due:
      return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
    case SubscriptionStatus.canceled:
      return 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400'
    case SubscriptionStatus.incomplete:
      return 'bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
    case SubscriptionStatus.trialing:
      return 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
    case SubscriptionStatus.unpaid:
      return 'bg-gray-50 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400'
    default:
      return 'bg-gray-50 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400'
  }
}

/**
 * Validates if a string can be parsed into a valid date
 * @param dateString - The date string to validate
 * @returns true if the date string is valid, false otherwise
 */
export function isValidDate(dateString: string | undefined | null): boolean {
  if (!dateString || typeof dateString !== 'string') {
    return false
  }

  const date = new Date(dateString)
  return !isNaN(date.getTime()) && dateString.trim() !== ''
}
