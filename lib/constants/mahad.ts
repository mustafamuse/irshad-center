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

// Feature Flags
export function isMahadCardPaymentsEnabled(): boolean {
  return process.env.MAHAD_CARD_PAYMENTS_ENABLED === 'true'
}

// Maximum expected rate in cents ($220 bi-monthly for non-graduate full-time)
export const MAX_EXPECTED_MAHAD_RATE = 22000

// WhatsApp Payment Message Template (English + Somali)
export function getWhatsAppPaymentMessage(paymentUrl: string): string {
  return `As-salāmu ʿalaykum wa raḥmatullāh.
From Irshad Mahad — please complete your registration by setting up autopay. Fadlan dhammaystir autopay registration-kaaga.
${paymentUrl}`
}
