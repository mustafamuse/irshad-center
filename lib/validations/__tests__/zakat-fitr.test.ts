import { describe, expect, it } from 'vitest'

import {
  MAX_FAMILY_SIZE,
  ZAKAT_FITR_PER_PERSON_CENTS,
  ZakatFitrCheckoutSchema,
  calculateStripeFee,
} from '../zakat-fitr'

describe('calculateStripeFee', () => {
  it('nets exactly $13 for 1 person after Stripe fee', () => {
    const { baseCents, totalCents, feeCents } = calculateStripeFee(1300)
    expect(baseCents).toBe(1300)
    expect(feeCents).toBeGreaterThan(0)
    const stripeKeeps = Math.ceil(totalCents * 0.029) + 30
    expect(totalCents - stripeKeeps).toBeGreaterThanOrEqual(1300)
  })

  it('nets exactly base amount for various family sizes', () => {
    for (let n = 1; n <= MAX_FAMILY_SIZE; n++) {
      const base = n * ZAKAT_FITR_PER_PERSON_CENTS
      const { totalCents } = calculateStripeFee(base)
      const stripeKeeps = Math.ceil(totalCents * 0.029) + 30
      expect(totalCents - stripeKeeps).toBeGreaterThanOrEqual(base)
    }
  })

  it('returns correct values for 3 people', () => {
    const { baseCents, totalCents } = calculateStripeFee(3 * 1300)
    expect(baseCents).toBe(3900)
    // Math.ceil((3900 + 30) / (1 - 0.029)) = Math.ceil(4048.40...) = 4048
    expect(totalCents).toBe(4048)
  })

  it('fee is always positive', () => {
    const { feeCents } = calculateStripeFee(1300)
    expect(feeCents).toBeGreaterThan(0)
  })
})

describe('ZakatFitrCheckoutSchema', () => {
  it('accepts valid input', () => {
    const result = ZakatFitrCheckoutSchema.safeParse({ numberOfPeople: 5 })
    expect(result.success).toBe(true)
  })

  it('accepts optional email', () => {
    const result = ZakatFitrCheckoutSchema.safeParse({
      numberOfPeople: 3,
      donorEmail: 'test@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects 0 people', () => {
    const result = ZakatFitrCheckoutSchema.safeParse({ numberOfPeople: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative people', () => {
    const result = ZakatFitrCheckoutSchema.safeParse({ numberOfPeople: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects more than MAX_FAMILY_SIZE', () => {
    const result = ZakatFitrCheckoutSchema.safeParse({
      numberOfPeople: MAX_FAMILY_SIZE + 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer', () => {
    const result = ZakatFitrCheckoutSchema.safeParse({ numberOfPeople: 2.5 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = ZakatFitrCheckoutSchema.safeParse({
      numberOfPeople: 1,
      donorEmail: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })
})
