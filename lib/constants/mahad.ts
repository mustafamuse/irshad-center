/**
 * Mahad Program Constants
 *
 * Centralized constants for the Mahad program
 *
 * Note: Pricing is now calculated dynamically via calculateMahadRate()
 * in lib/utils/mahad-tuition.ts based on graduationStatus, paymentFrequency,
 * and billingType.
 */

// Program Constants
export const MAHAD_PROGRAM = 'MAHAD_PROGRAM' as const
export const MAHAD_WEBHOOK_SOURCE = 'mahad' as const
