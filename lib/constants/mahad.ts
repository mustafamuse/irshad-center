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

// Maximum expected rate in cents ($220 bi-monthly for non-graduate full-time)
export const MAX_EXPECTED_MAHAD_RATE = 22000

/**
 * Mahad admin WhatsApp number (E.164 without `+`, suitable for wa.me links).
 * Used by the public verification flow as the support escape channel.
 */
export const MAHAD_WHATSAPP_E164 = '16125177466' as const

/**
 * Build a wa.me deep link with a pre-filled message.
 * Use for the lookup not-found escape and the success-page contact CTA.
 */
export function buildMahadWhatsAppLink(message: string): string {
  return `https://wa.me/${MAHAD_WHATSAPP_E164}?text=${encodeURIComponent(message)}`
}

// WhatsApp Payment Message Template (English + Somali)
export function getWhatsAppPaymentMessage(paymentUrl: string): string {
  return `As-salāmu ʿalaykum wa raḥmatullāh.
From Irshad Mahad — please complete your registration by setting up autopay. Fadlan dhammaystir autopay registration-kaaga.
${paymentUrl}`
}
