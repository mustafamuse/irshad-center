import { describe, expect, it } from 'vitest'

import {
  PauseFamilyBillingSchema,
  ReEnrollChildSchema,
  ResumeFamilyBillingSchema,
  WithdrawChildSchema,
  WithdrawFamilySchema,
} from '../dugsi'

describe('WithdrawChildSchema', () => {
  const validInput = {
    studentId: 'student-123',
    reason: 'family_moved' as const,
    billingAdjustment: { type: 'auto_recalculate' as const },
  }

  it('accepts valid input', () => {
    const result = WithdrawChildSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('accepts valid input with cancel_subscription billing adjustment', () => {
    const result = WithdrawChildSchema.safeParse({
      ...validInput,
      billingAdjustment: { type: 'cancel_subscription' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid input with optional reasonNote', () => {
    const result = WithdrawChildSchema.safeParse({
      ...validInput,
      reasonNote: 'Moving to another state',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing studentId', () => {
    const result = WithdrawChildSchema.safeParse({
      reason: 'family_moved',
      billingAdjustment: { type: 'auto_recalculate' },
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain('studentId')
  })

  it('rejects empty studentId', () => {
    const result = WithdrawChildSchema.safeParse({
      ...validInput,
      studentId: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid reason value', () => {
    const result = WithdrawChildSchema.safeParse({
      ...validInput,
      reason: 'invalid_reason',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain('reason')
  })

  it('rejects reasonNote exceeding 500 characters', () => {
    const result = WithdrawChildSchema.safeParse({
      ...validInput,
      reasonNote: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain('reasonNote')
  })

  it('rejects invalid billingAdjustment type', () => {
    const result = WithdrawChildSchema.safeParse({
      ...validInput,
      billingAdjustment: { type: 'invalid_type' },
    })
    expect(result.success).toBe(false)
  })
})

describe('WithdrawFamilySchema', () => {
  const validInput = {
    familyReferenceId: 'family-ref-456',
    reason: 'financial' as const,
  }

  it('accepts valid input', () => {
    const result = WithdrawFamilySchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('accepts valid input with optional reasonNote', () => {
    const result = WithdrawFamilySchema.safeParse({
      ...validInput,
      reasonNote: 'Cannot afford tuition',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing familyReferenceId', () => {
    const result = WithdrawFamilySchema.safeParse({
      reason: 'financial',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain('familyReferenceId')
  })

  it('rejects empty familyReferenceId', () => {
    const result = WithdrawFamilySchema.safeParse({
      ...validInput,
      familyReferenceId: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid reason', () => {
    const result = WithdrawFamilySchema.safeParse({
      ...validInput,
      reason: 'not_a_valid_reason',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain('reason')
  })
})

describe('ReEnrollChildSchema', () => {
  it('accepts valid input', () => {
    const result = ReEnrollChildSchema.safeParse({ studentId: 'student-789' })
    expect(result.success).toBe(true)
  })

  it('rejects empty studentId', () => {
    const result = ReEnrollChildSchema.safeParse({ studentId: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain('studentId')
  })

  it('rejects missing studentId', () => {
    const result = ReEnrollChildSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('PauseFamilyBillingSchema', () => {
  it('accepts a valid UUID', () => {
    const result = PauseFamilyBillingSchema.safeParse({
      familyReferenceId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    const result = PauseFamilyBillingSchema.safeParse({
      familyReferenceId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(
      'Invalid family reference ID format'
    )
  })
})

describe('ResumeFamilyBillingSchema', () => {
  it('accepts a valid UUID', () => {
    const result = ResumeFamilyBillingSchema.safeParse({
      familyReferenceId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    const result = ResumeFamilyBillingSchema.safeParse({
      familyReferenceId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(
      'Invalid family reference ID format'
    )
  })
})
