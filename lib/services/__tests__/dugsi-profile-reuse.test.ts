import { vi, describe, it, expect } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {},
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  logError: vi.fn(),
}))

import {
  buildDugsiProfileReuseUpdate,
  isBlockedFamilyReassignment,
} from '../registration-service'

describe('buildDugsiProfileReuseUpdate', () => {
  const familyReferenceId = 'family-ref-1'

  it('resets a WITHDRAWN profile to REGISTERED', () => {
    const update = buildDugsiProfileReuseUpdate(
      'WITHDRAWN',
      {},
      familyReferenceId
    )

    expect(update).toEqual({
      status: 'REGISTERED',
      familyReferenceId,
    })
  })

  it('preserves a non-withdrawn status', () => {
    for (const status of ['REGISTERED', 'ENROLLED', 'ON_LEAVE'] as const) {
      const update = buildDugsiProfileReuseUpdate(status, {}, familyReferenceId)
      expect(update).not.toHaveProperty('status')
    }
  })

  it('includes only provided demographic fields', () => {
    const update = buildDugsiProfileReuseUpdate(
      'ENROLLED',
      {
        gender: 'MALE',
        gradeLevel: null,
        schoolName: 'Lake Middle School',
      },
      familyReferenceId
    )

    expect(update).toEqual({
      gender: 'MALE',
      schoolName: 'Lake Middle School',
      familyReferenceId,
    })
  })

  it('combines status reset with demographic updates', () => {
    const update = buildDugsiProfileReuseUpdate(
      'WITHDRAWN',
      { shift: 'MORNING' },
      familyReferenceId
    )

    expect(update).toEqual({
      shift: 'MORNING',
      status: 'REGISTERED',
      familyReferenceId,
    })
  })
})

describe('isBlockedFamilyReassignment', () => {
  const newFamilyId = 'new-family-ref'

  it('allows a profile with no family assignment', () => {
    expect(
      isBlockedFamilyReassignment(
        { familyReferenceId: null, status: 'WITHDRAWN' },
        newFamilyId,
        false
      )
    ).toBe(false)
  })

  it('allows a profile already in the same family', () => {
    expect(
      isBlockedFamilyReassignment(
        { familyReferenceId: newFamilyId, status: 'ENROLLED' },
        newFamilyId,
        false
      )
    ).toBe(false)
  })

  it('blocks cross-family reassignment of a non-withdrawn child', () => {
    for (const status of ['REGISTERED', 'ENROLLED', 'ON_LEAVE'] as const) {
      expect(
        isBlockedFamilyReassignment(
          { familyReferenceId: 'old-family-ref', status },
          newFamilyId,
          true
        )
      ).toBe(true)
    }
  })

  it('blocks a withdrawn child without guardian continuity (name+DOB stranger)', () => {
    expect(
      isBlockedFamilyReassignment(
        { familyReferenceId: 'old-family-ref', status: 'WITHDRAWN' },
        newFamilyId,
        false
      )
    ).toBe(true)
  })

  it('allows a withdrawn child when a submitted parent is an existing guardian', () => {
    expect(
      isBlockedFamilyReassignment(
        { familyReferenceId: 'old-family-ref', status: 'WITHDRAWN' },
        newFamilyId,
        true
      )
    ).toBe(false)
  })
})
