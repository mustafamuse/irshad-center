// WhatsApp Cloud API Constants
// Template names must match exactly with Meta-approved templates

import { Program } from '@prisma/client'

// Template names for Meta approval
// Format: {program}_{purpose}
export const WHATSAPP_TEMPLATES = {
  // Dugsi Program Templates
  DUGSI_PAYMENT_LINK: 'dugsi_payment_link',
  DUGSI_PAYMENT_CONFIRMED: 'dugsi_payment_confirmed',
  DUGSI_PAYMENT_REMINDER: 'dugsi_payment_reminder',
  DUGSI_BANK_VERIFY: 'dugsi_bank_verify',
  DUGSI_CLASS_ANNOUNCEMENT: 'dugsi_class_announcement',

  // Mahad Program Templates (future)
  MAHAD_PAYMENT_LINK: 'mahad_payment_link',
  MAHAD_PAYMENT_CONFIRMED: 'mahad_payment_confirmed',
  MAHAD_PAYMENT_REMINDER: 'mahad_payment_reminder',

  // Shared Templates
  GENERAL_ANNOUNCEMENT: 'irshad_announcement',
} as const

export type WhatsAppTemplate =
  (typeof WHATSAPP_TEMPLATES)[keyof typeof WHATSAPP_TEMPLATES]

// Emoji reactions for message status feedback
export const REACTION_EMOJIS = {
  PROCESSING: '\u23F3', // ⏳ Hourglass
  SUCCESS: '\u2705', // ✅ White check mark
  ERROR: '\u274C', // ❌ Cross mark
  DELIVERED: '\u2714', // ✔ Check mark
  READ: '\u{1F440}', // 👀 Eyes
} as const

// WhatsApp API configuration
export const WHATSAPP_API_VERSION = 'v21.0'
export const WHATSAPP_API_BASE_URL = 'https://graph.facebook.com'

// Template parameter mappings
// Maps template names to their expected parameters
export const TEMPLATE_PARAMS = {
  [WHATSAPP_TEMPLATES.DUGSI_PAYMENT_LINK]: {
    body: ['parentName', 'amount', 'childCount'],
    button: ['paymentUrl'], // Dynamic URL suffix for CTA button
  },
  [WHATSAPP_TEMPLATES.DUGSI_PAYMENT_CONFIRMED]: {
    body: ['parentName', 'amount', 'nextPaymentDate', 'studentNames'],
  },
  [WHATSAPP_TEMPLATES.DUGSI_PAYMENT_REMINDER]: {
    body: ['parentName', 'amount', 'dueDate'],
    button: ['billingUrl'],
  },
  [WHATSAPP_TEMPLATES.DUGSI_BANK_VERIFY]: {
    body: ['parentName', 'verificationUrl'],
  },
  [WHATSAPP_TEMPLATES.DUGSI_CLASS_ANNOUNCEMENT]: {
    body: ['message'],
  },
} as const

// Get template for a specific program
export function getPaymentLinkTemplate(program: Program): WhatsAppTemplate {
  switch (program) {
    case 'DUGSI_PROGRAM':
      return WHATSAPP_TEMPLATES.DUGSI_PAYMENT_LINK
    case 'MAHAD_PROGRAM':
      return WHATSAPP_TEMPLATES.MAHAD_PAYMENT_LINK
    default:
      return WHATSAPP_TEMPLATES.DUGSI_PAYMENT_LINK
  }
}

export function getPaymentConfirmedTemplate(
  program: Program
): WhatsAppTemplate {
  switch (program) {
    case 'DUGSI_PROGRAM':
      return WHATSAPP_TEMPLATES.DUGSI_PAYMENT_CONFIRMED
    case 'MAHAD_PROGRAM':
      return WHATSAPP_TEMPLATES.MAHAD_PAYMENT_CONFIRMED
    default:
      return WHATSAPP_TEMPLATES.DUGSI_PAYMENT_CONFIRMED
  }
}

export function getPaymentReminderTemplate(program: Program): WhatsAppTemplate {
  switch (program) {
    case 'DUGSI_PROGRAM':
      return WHATSAPP_TEMPLATES.DUGSI_PAYMENT_REMINDER
    case 'MAHAD_PROGRAM':
      return WHATSAPP_TEMPLATES.MAHAD_PAYMENT_REMINDER
    default:
      return WHATSAPP_TEMPLATES.DUGSI_PAYMENT_REMINDER
  }
}
