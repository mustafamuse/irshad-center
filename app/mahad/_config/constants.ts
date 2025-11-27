/**
 * Mahad-wide constants
 * Centralized configuration for magic numbers, dates, and settings
 *
 * Note: Pricing is now calculated dynamically via calculateMahadRate()
 * in lib/utils/mahad-tuition.ts based on graduationStatus, paymentFrequency,
 * and billingType.
 */

// Dates
export const ACADEMIC_CALENDAR = {
  SEMESTER_END_DATE: new Date('2025-09-07T23:59:59'),
  REGISTRATION_START: new Date('2024-07-01'),
  REGISTRATION_END: new Date('2025-06-30'),
} as const

// Form Settings
export const FORM_CONFIG = {
  MAX_SIBLING_GROUP_SIZE: 15,
  MIN_ESSAY_LENGTH: 50,
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 11,
} as const

// Cache/Retry Settings
export const CACHE_CONFIG = {
  QUERY_STALE_TIME: 1000 * 60, // 1 minute
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
} as const

// Contact
export const CONTACT = {
  OFFICE_EMAIL: 'umpp101@gmail.com',
  SUPPORT_EMAIL: 'support@irshadcenter.com',
} as const
