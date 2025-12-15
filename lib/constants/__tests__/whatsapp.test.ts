import { Program } from '@prisma/client'
import { describe, it, expect } from 'vitest'

import {
  WHATSAPP_TEMPLATES,
  REACTION_EMOJIS,
  getPaymentLinkTemplate,
  getPaymentConfirmedTemplate,
  getPaymentReminderTemplate,
} from '../whatsapp'

describe('WHATSAPP_TEMPLATES', () => {
  it('should have Dugsi templates', () => {
    expect(WHATSAPP_TEMPLATES.DUGSI_PAYMENT_LINK).toBe('dugsi_payment_link')
    expect(WHATSAPP_TEMPLATES.DUGSI_PAYMENT_CONFIRMED).toBe(
      'dugsi_payment_confirmed'
    )
    expect(WHATSAPP_TEMPLATES.DUGSI_PAYMENT_REMINDER).toBe(
      'dugsi_payment_reminder'
    )
    expect(WHATSAPP_TEMPLATES.DUGSI_BANK_VERIFY).toBe('dugsi_bank_verify')
    expect(WHATSAPP_TEMPLATES.DUGSI_CLASS_ANNOUNCEMENT).toBe(
      'dugsi_class_announcement'
    )
  })

  it('should have Mahad templates', () => {
    expect(WHATSAPP_TEMPLATES.MAHAD_PAYMENT_LINK).toBe('mahad_payment_link')
    expect(WHATSAPP_TEMPLATES.MAHAD_PAYMENT_CONFIRMED).toBe(
      'mahad_payment_confirmed'
    )
    expect(WHATSAPP_TEMPLATES.MAHAD_PAYMENT_REMINDER).toBe(
      'mahad_payment_reminder'
    )
  })

  it('should have shared templates', () => {
    expect(WHATSAPP_TEMPLATES.GENERAL_ANNOUNCEMENT).toBe('irshad_announcement')
  })
})

describe('REACTION_EMOJIS', () => {
  it('should have correct emoji values', () => {
    expect(REACTION_EMOJIS.PROCESSING).toBe('\u23F3')
    expect(REACTION_EMOJIS.SUCCESS).toBe('\u2705')
    expect(REACTION_EMOJIS.ERROR).toBe('\u274C')
    expect(REACTION_EMOJIS.DELIVERED).toBe('\u2714')
    expect(REACTION_EMOJIS.READ).toBe('\u{1F440}')
  })
})

describe('getPaymentLinkTemplate', () => {
  it('should return DUGSI_PAYMENT_LINK for DUGSI_PROGRAM', () => {
    const result = getPaymentLinkTemplate(Program.DUGSI_PROGRAM)
    expect(result).toBe(WHATSAPP_TEMPLATES.DUGSI_PAYMENT_LINK)
  })

  it('should return MAHAD_PAYMENT_LINK for MAHAD_PROGRAM', () => {
    const result = getPaymentLinkTemplate(Program.MAHAD_PROGRAM)
    expect(result).toBe(WHATSAPP_TEMPLATES.MAHAD_PAYMENT_LINK)
  })

  it('should default to DUGSI_PAYMENT_LINK for unknown program', () => {
    const result = getPaymentLinkTemplate('UNKNOWN' as Program)
    expect(result).toBe(WHATSAPP_TEMPLATES.DUGSI_PAYMENT_LINK)
  })
})

describe('getPaymentConfirmedTemplate', () => {
  it('should return DUGSI_PAYMENT_CONFIRMED for DUGSI_PROGRAM', () => {
    const result = getPaymentConfirmedTemplate(Program.DUGSI_PROGRAM)
    expect(result).toBe(WHATSAPP_TEMPLATES.DUGSI_PAYMENT_CONFIRMED)
  })

  it('should return MAHAD_PAYMENT_CONFIRMED for MAHAD_PROGRAM', () => {
    const result = getPaymentConfirmedTemplate(Program.MAHAD_PROGRAM)
    expect(result).toBe(WHATSAPP_TEMPLATES.MAHAD_PAYMENT_CONFIRMED)
  })

  it('should default to DUGSI_PAYMENT_CONFIRMED for unknown program', () => {
    const result = getPaymentConfirmedTemplate('UNKNOWN' as Program)
    expect(result).toBe(WHATSAPP_TEMPLATES.DUGSI_PAYMENT_CONFIRMED)
  })
})

describe('getPaymentReminderTemplate', () => {
  it('should return DUGSI_PAYMENT_REMINDER for DUGSI_PROGRAM', () => {
    const result = getPaymentReminderTemplate(Program.DUGSI_PROGRAM)
    expect(result).toBe(WHATSAPP_TEMPLATES.DUGSI_PAYMENT_REMINDER)
  })

  it('should return MAHAD_PAYMENT_REMINDER for MAHAD_PROGRAM', () => {
    const result = getPaymentReminderTemplate(Program.MAHAD_PROGRAM)
    expect(result).toBe(WHATSAPP_TEMPLATES.MAHAD_PAYMENT_REMINDER)
  })

  it('should default to DUGSI_PAYMENT_REMINDER for unknown program', () => {
    const result = getPaymentReminderTemplate('UNKNOWN' as Program)
    expect(result).toBe(WHATSAPP_TEMPLATES.DUGSI_PAYMENT_REMINDER)
  })
})
