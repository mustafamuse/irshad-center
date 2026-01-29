/**
 * Dugsi Program Constants
 *
 * Centralized constants for the Dugsi program
 */

import type { Shift as DugsiShift } from '@prisma/client'

export const DEFAULT_PAGE_SIZE = 20
export const DEFAULT_QUERY_LIMIT = 50

export const STRIPE_ID_DISPLAY_LENGTH = 20
export const MAX_FAMILY_SIZE = 20
export const MIN_FAMILY_SIZE = 1

// Stripe Prefixes
export const STRIPE_CUSTOMER_PREFIX = 'cus_'
export const STRIPE_SUBSCRIPTION_PREFIX = 'sub_'
export const STRIPE_PAYMENT_INTENT_PREFIX = 'pi_'
export const STRIPE_CHECKOUT_SESSION_PREFIX = 'cs_'

// Program Constants
export const DUGSI_PROGRAM = 'DUGSI_PROGRAM' as const
export const DUGSI_WEBHOOK_SOURCE = 'dugsi' as const

// Dashboard URLs
export const STRIPE_DASHBOARD_BASE_URL = 'https://dashboard.stripe.com'

export function getStripeCustomerUrl(customerId: string): string {
  return `${STRIPE_DASHBOARD_BASE_URL}/customers/${customerId}`
}

export function getStripeSubscriptionUrl(subscriptionId: string): string {
  return `${STRIPE_DASHBOARD_BASE_URL}/subscriptions/${subscriptionId}`
}

// Date Formats
export const DATE_FORMAT = 'MMM d, yyyy'
export const DATE_TIME_FORMAT = 'MMM d, yyyy h:mm a'
export const SHORT_DATE_FORMAT = 'MM/dd/yyyy'

// UI Constants
export const DEBOUNCE_DELAY = 300 // milliseconds
export const REFRESH_DELAY = 500 // milliseconds

// Transaction Timeouts
export const BULK_ENROLLMENT_TIMEOUT_MS = 30000 // 30 seconds for bulk operations

// Validation Constants
export const MAX_EMAIL_LENGTH = 320
export const MAX_NAME_LENGTH = 100
export const MAX_PHONE_LENGTH = 20

// Brand Colors
export const BRAND_COLORS = {
  teal: '#007078',
  gold: '#deb43e',
} as const

// Colors and Themes (legacy - use BRAND_COLORS instead)
export const DUGSI_PRIMARY_COLOR = '#007078'

// Status Colors
export const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  canceled: 'bg-red-100 text-red-800',
  past_due: 'bg-orange-100 text-orange-800',
} as const

// Badge Variants
export const SUBSCRIPTION_STATUS_BADGES = {
  active: {
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
    label: 'Active',
  },
  past_due: {
    className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
    label: 'Past Due',
  },
  canceled: {
    className: 'bg-red-100 text-red-800 hover:bg-red-100',
    label: 'Canceled',
  },
  incomplete: {
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    label: 'Incomplete',
  },
  incomplete_expired: {
    className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    label: 'Expired',
  },
  trialing: {
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    label: 'Trial',
  },
  unpaid: {
    className: 'bg-red-100 text-red-800 hover:bg-red-100',
    label: 'Unpaid',
  },
  paused: {
    className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    label: 'Paused',
  },
} as const

// Shift Badge Styles (Morning uses brand gold, Afternoon uses teal)
export const SHIFT_BADGES = {
  MORNING: {
    className:
      'bg-[#deb43e]/15 text-[#996b1d] border-[#deb43e]/30 hover:bg-[#deb43e]/20',
    label: 'Morning',
  },
  AFTERNOON: {
    className:
      'bg-[#007078]/10 text-[#007078] border-[#007078]/20 hover:bg-[#007078]/15',
    label: 'Afternoon',
  },
} as const

// Shift Indicator Colors (for dots/icons)
export const SHIFT_COLORS = {
  MORNING: 'bg-[#deb43e]',
  AFTERNOON: 'bg-[#007078]',
} as const

// Shift Short Labels (for compact display)
export const SHIFT_SHORT_LABEL: Record<DugsiShift, string> = {
  MORNING: 'AM',
  AFTERNOON: 'PM',
}

// Shift Filter Constants
export const SHIFT_FILTER_ALL = 'all' as const

// Shift Select Options (for dropdowns)
export const SHIFT_OPTIONS = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'AFTERNOON', label: 'Afternoon' },
] as const

// Error Messages
export const ERROR_MESSAGES = {
  STUDENT_NOT_FOUND: 'Student not found',
  FAMILY_NOT_FOUND: 'No students found for this family',
  SUBSCRIPTION_NOT_FOUND: 'Subscription not found in Stripe',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_SUBSCRIPTION_ID: 'Invalid subscription ID format',
  PAYMENT_METHOD_REQUIRED: 'Payment method must be captured first',
  DATABASE_ERROR: 'Database operation failed',
  STRIPE_API_ERROR: 'Stripe API error occurred',
  WEBHOOK_SIGNATURE_INVALID: 'Invalid webhook signature',
  DUPLICATE_EVENT: 'Event already processed',
} as const

// Success Messages
export const SUCCESS_MESSAGES = {
  SUBSCRIPTION_LINKED: 'Subscription linked successfully',
  FAMILY_DELETED: 'Family deleted successfully',
  PAYMENT_CAPTURED: 'Payment method captured successfully',
  STATUS_REFRESHED: 'Payment status refreshed',
} as const

// WhatsApp Payment Message Template (English + Somali)
export function getWhatsAppPaymentMessage(paymentUrl: string): string {
  return `As-salāmu ʿalaykum wa raḥmatullāh.
From Irshad Dugsi — please complete your registration by setting up autopay. Fadlan dhammaystir autopay registration-kaaga.
${paymentUrl}`
}
