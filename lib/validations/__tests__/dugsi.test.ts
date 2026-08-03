import { describe, expect, it } from 'vitest'

import { WITHDRAWAL_REASONS } from '@/lib/constants/dugsi'
import {
  WithdrawChildrenSchema,
  formatWithdrawalReason,
} from '@/lib/validations/dugsi'

const VALID_INPUT = {
  familyReferenceId: '5b21ca75-1c11-4c2e-9d3b-111111111111',
  profileIds: ['5b21ca75-1c11-4c2e-9d3b-222222222222'],
  reason: 'Moved away',
}

describe('WithdrawChildrenSchema reason fields', () => {
  it('accepts a preset reason without a note', () => {
    expect(WithdrawChildrenSchema.safeParse(VALID_INPUT).success).toBe(true)
  })

  it('rejects a reason outside the preset list', () => {
    const result = WithdrawChildrenSchema.safeParse({
      ...VALID_INPUT,
      reason: 'Because',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing reason', () => {
    const { reason: _reason, ...rest } = VALID_INPUT
    expect(WithdrawChildrenSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a note longer than 200 chars', () => {
    const result = WithdrawChildrenSchema.safeParse({
      ...VALID_INPUT,
      note: 'x'.repeat(201),
    })
    expect(result.success).toBe(false)
  })
})

describe('formatWithdrawalReason', () => {
  it('returns the preset alone when there is no note', () => {
    expect(formatWithdrawalReason('Financial')).toBe('Financial')
  })

  it('joins preset and note with a colon', () => {
    expect(formatWithdrawalReason('Other', 'moving abroad')).toBe(
      'Other: moving abroad'
    )
  })

  it('ignores an empty note', () => {
    expect(formatWithdrawalReason('Financial', '  ')).toBe('Financial')
  })
})

describe('WITHDRAWAL_REASONS', () => {
  it('stays distinct from system reason strings', () => {
    expect(WITHDRAWAL_REASONS).not.toContain('Withdrawn by admin')
    expect(WITHDRAWAL_REASONS).not.toContain('Subscription canceled')
  })
})
