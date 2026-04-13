/**
 * Attendance Status Transition Matrix Tests
 *
 * Covers all 36 transition pairs (6 from-states × 6 to-states),
 * the LATE→LATE self-loop, and assertValidTransition error shape.
 */

import { describe, it, expect } from 'vitest'

import { ERROR_CODES } from '@/lib/errors/action-error'
import {
  isValidTransition,
  getAllowedTransitions,
  assertValidTransition,
} from '@/lib/utils/attendance-transitions'

// ─── EXPECTED ────────────────────────────────────────────────────────────────

describe('isValidTransition from EXPECTED', () => {
  it('allows EXPECTED → PRESENT', () => {
    expect(isValidTransition('EXPECTED', 'PRESENT')).toBe(true)
  })
  it('allows EXPECTED → LATE', () => {
    expect(isValidTransition('EXPECTED', 'LATE')).toBe(true)
  })
  it('allows EXPECTED → ABSENT', () => {
    expect(isValidTransition('EXPECTED', 'ABSENT')).toBe(true)
  })
  it('allows EXPECTED → CLOSED (system-only bulk propagation)', () => {
    expect(isValidTransition('EXPECTED', 'CLOSED')).toBe(true)
  })
  it('rejects EXPECTED → EXPECTED', () => {
    expect(isValidTransition('EXPECTED', 'EXPECTED')).toBe(false)
  })
  it('rejects EXPECTED → EXCUSED', () => {
    expect(isValidTransition('EXPECTED', 'EXCUSED')).toBe(false)
  })
})

// ─── PRESENT ─────────────────────────────────────────────────────────────────

describe('isValidTransition from PRESENT', () => {
  it('allows PRESENT → ABSENT', () => {
    expect(isValidTransition('PRESENT', 'ABSENT')).toBe(true)
  })
  it('allows PRESENT → EXCUSED', () => {
    expect(isValidTransition('PRESENT', 'EXCUSED')).toBe(true)
  })
  it('allows PRESENT → LATE', () => {
    expect(isValidTransition('PRESENT', 'LATE')).toBe(true)
  })
  it('rejects PRESENT → EXPECTED', () => {
    expect(isValidTransition('PRESENT', 'EXPECTED')).toBe(false)
  })
  it('rejects PRESENT → PRESENT', () => {
    expect(isValidTransition('PRESENT', 'PRESENT')).toBe(false)
  })
  it('rejects PRESENT → CLOSED', () => {
    expect(isValidTransition('PRESENT', 'CLOSED')).toBe(false)
  })
})

// ─── LATE ─────────────────────────────────────────────────────────────────────

describe('isValidTransition from LATE', () => {
  it('allows LATE → ABSENT', () => {
    expect(isValidTransition('LATE', 'ABSENT')).toBe(true)
  })
  it('allows LATE → EXCUSED', () => {
    expect(isValidTransition('LATE', 'EXCUSED')).toBe(true)
  })
  it('allows LATE → PRESENT', () => {
    expect(isValidTransition('LATE', 'PRESENT')).toBe(true)
  })
  // LATE→LATE is intentional: self-check-in can update clockInTime/source on an
  // auto-marked LATE record without changing the displayed status.
  it('allows LATE → LATE (self-loop for clockInTime updates on auto-marked records)', () => {
    expect(isValidTransition('LATE', 'LATE')).toBe(true)
  })
  it('rejects LATE → EXPECTED', () => {
    expect(isValidTransition('LATE', 'EXPECTED')).toBe(false)
  })
  it('rejects LATE → CLOSED', () => {
    expect(isValidTransition('LATE', 'CLOSED')).toBe(false)
  })
})

// ─── ABSENT ───────────────────────────────────────────────────────────────────

describe('isValidTransition from ABSENT', () => {
  it('allows ABSENT → LATE', () => {
    expect(isValidTransition('ABSENT', 'LATE')).toBe(true)
  })
  it('allows ABSENT → EXCUSED', () => {
    expect(isValidTransition('ABSENT', 'EXCUSED')).toBe(true)
  })
  it('allows ABSENT → PRESENT', () => {
    expect(isValidTransition('ABSENT', 'PRESENT')).toBe(true)
  })
  it('rejects ABSENT → EXPECTED', () => {
    expect(isValidTransition('ABSENT', 'EXPECTED')).toBe(false)
  })
  it('rejects ABSENT → ABSENT', () => {
    expect(isValidTransition('ABSENT', 'ABSENT')).toBe(false)
  })
  it('rejects ABSENT → CLOSED', () => {
    expect(isValidTransition('ABSENT', 'CLOSED')).toBe(false)
  })
})

// ─── EXCUSED ──────────────────────────────────────────────────────────────────

describe('isValidTransition from EXCUSED', () => {
  it('allows EXCUSED → LATE (admin reverts erroneously approved excuse)', () => {
    expect(isValidTransition('EXCUSED', 'LATE')).toBe(true)
  })
  it('allows EXCUSED → ABSENT (admin reverts erroneously approved excuse)', () => {
    expect(isValidTransition('EXCUSED', 'ABSENT')).toBe(true)
  })
  it('rejects EXCUSED → EXPECTED', () => {
    expect(isValidTransition('EXCUSED', 'EXPECTED')).toBe(false)
  })
  it('rejects EXCUSED → PRESENT', () => {
    expect(isValidTransition('EXCUSED', 'PRESENT')).toBe(false)
  })
  it('rejects EXCUSED → EXCUSED', () => {
    expect(isValidTransition('EXCUSED', 'EXCUSED')).toBe(false)
  })
  it('rejects EXCUSED → CLOSED', () => {
    expect(isValidTransition('EXCUSED', 'CLOSED')).toBe(false)
  })
})

// ─── CLOSED ───────────────────────────────────────────────────────────────────

describe('isValidTransition from CLOSED', () => {
  // CLOSED→PRESENT: admin confirms a teacher physically showed up on a closed day.
  it('allows CLOSED → PRESENT (admin override for physically-present teacher)', () => {
    expect(isValidTransition('CLOSED', 'PRESENT')).toBe(true)
  })
  it('rejects CLOSED → EXPECTED (use removeClosure() instead)', () => {
    expect(isValidTransition('CLOSED', 'EXPECTED')).toBe(false)
  })
  it('rejects CLOSED → LATE', () => {
    expect(isValidTransition('CLOSED', 'LATE')).toBe(false)
  })
  it('rejects CLOSED → ABSENT', () => {
    expect(isValidTransition('CLOSED', 'ABSENT')).toBe(false)
  })
  it('rejects CLOSED → EXCUSED', () => {
    expect(isValidTransition('CLOSED', 'EXCUSED')).toBe(false)
  })
  it('rejects CLOSED → CLOSED', () => {
    expect(isValidTransition('CLOSED', 'CLOSED')).toBe(false)
  })
})

// ─── getAllowedTransitions ────────────────────────────────────────────────────

describe('getAllowedTransitions', () => {
  it('returns correct set for EXPECTED', () => {
    expect(getAllowedTransitions('EXPECTED')).toEqual(
      expect.arrayContaining(['PRESENT', 'LATE', 'ABSENT', 'CLOSED'])
    )
    expect(getAllowedTransitions('EXPECTED')).toHaveLength(4)
  })
  it('returns correct set for PRESENT', () => {
    expect(getAllowedTransitions('PRESENT')).toEqual(
      expect.arrayContaining(['ABSENT', 'EXCUSED', 'LATE'])
    )
    expect(getAllowedTransitions('PRESENT')).toHaveLength(3)
  })
  it('returns correct set for LATE (includes self)', () => {
    expect(getAllowedTransitions('LATE')).toEqual(
      expect.arrayContaining(['ABSENT', 'EXCUSED', 'PRESENT', 'LATE'])
    )
    expect(getAllowedTransitions('LATE')).toHaveLength(4)
  })
  it('returns correct set for ABSENT', () => {
    expect(getAllowedTransitions('ABSENT')).toEqual(
      expect.arrayContaining(['LATE', 'EXCUSED', 'PRESENT'])
    )
    expect(getAllowedTransitions('ABSENT')).toHaveLength(3)
  })
  it('returns correct set for EXCUSED', () => {
    expect(getAllowedTransitions('EXCUSED')).toEqual(
      expect.arrayContaining(['LATE', 'ABSENT'])
    )
    expect(getAllowedTransitions('EXCUSED')).toHaveLength(2)
  })
  it('returns correct set for CLOSED', () => {
    expect(getAllowedTransitions('CLOSED')).toEqual(['PRESENT'])
    expect(getAllowedTransitions('CLOSED')).toHaveLength(1)
  })
})

// ─── assertValidTransition ───────────────────────────────────────────────────

describe('assertValidTransition', () => {
  it('does not throw for EXPECTED → PRESENT', () => {
    expect(() => assertValidTransition('EXPECTED', 'PRESENT')).not.toThrow()
  })

  it('does not throw for LATE → LATE (self-loop)', () => {
    expect(() => assertValidTransition('LATE', 'LATE')).not.toThrow()
  })

  it('does not throw for CLOSED → PRESENT (admin override)', () => {
    expect(() => assertValidTransition('CLOSED', 'PRESENT')).not.toThrow()
  })

  it('throws ActionError with INVALID_TRANSITION code for a disallowed transition', () => {
    expect(() => assertValidTransition('CLOSED', 'ABSENT')).toThrow(
      expect.objectContaining({ code: ERROR_CODES.INVALID_TRANSITION })
    )
  })

  it('includes the from and to statuses in the error message', () => {
    expect(() => assertValidTransition('EXCUSED', 'PRESENT')).toThrow(
      /EXCUSED.*PRESENT/
    )
  })

  it('includes the allowed transitions in the error message', () => {
    expect(() => assertValidTransition('CLOSED', 'LATE')).toThrow(/PRESENT/)
  })
})
