import type { AttendanceSource, TeacherAttendanceStatus } from '@prisma/client'
import { describe, it, expect } from 'vitest'

import { ERROR_CODES } from '@/lib/errors/action-error'
import {
  canTeacherTransition,
  canAdminTransition,
  canSystemTransition,
  assertAdminTransition,
  assertSystemTransition,
  getAdminAllowedTransitions,
} from '@/lib/utils/attendance-transitions'

// ─── canTeacherTransition ────────────────────────────────────────────────────

describe('canTeacherTransition', () => {
  const cases: [
    TeacherAttendanceStatus,
    AttendanceSource | null,
    TeacherAttendanceStatus,
    boolean,
  ][] = [
    // EXPECTED — on-time or late clock-in
    ['EXPECTED', null, 'PRESENT', true],
    ['EXPECTED', null, 'LATE', true],
    ['EXPECTED', null, 'ABSENT', false],
    ['EXPECTED', null, 'EXCUSED', false],
    ['EXPECTED', null, 'CLOSED', false],
    ['EXPECTED', null, 'EXPECTED', false],
    // LATE — update clockInTime on auto-marked record, or arrive (improbably) on-time
    ['LATE', 'AUTO_MARKED', 'LATE', true],
    ['LATE', 'AUTO_MARKED', 'PRESENT', true],
    ['LATE', 'AUTO_MARKED', 'ABSENT', false],
    ['LATE', 'AUTO_MARKED', 'EXCUSED', false],
    ['LATE', 'AUTO_MARKED', 'CLOSED', false],
    // ABSENT — physically shows up after auto-mark (SYSTEM source allowed)
    ['ABSENT', 'SYSTEM', 'PRESENT', true],
    ['ABSENT', 'SYSTEM', 'LATE', true],
    ['ABSENT', 'SYSTEM', 'ABSENT', false],
    ['ABSENT', 'SYSTEM', 'EXCUSED', false],
    // ABSENT — admin explicitly set ABSENT; self-checkin blocked regardless of target
    ['ABSENT', 'ADMIN_OVERRIDE', 'PRESENT', false],
    ['ABSENT', 'ADMIN_OVERRIDE', 'LATE', false],
    // Statuses that block self-checkin entirely
    ['PRESENT', 'SELF_CHECKIN', 'PRESENT', false],
    ['PRESENT', 'SELF_CHECKIN', 'LATE', false],
    ['EXCUSED', 'ADMIN_OVERRIDE', 'PRESENT', false],
    ['CLOSED', 'SYSTEM', 'PRESENT', false],
  ]

  it.each(cases)(
    'from %s (source=%s) → %s = %s',
    (from, source, to, expected) => {
      expect(canTeacherTransition(from, source, to)).toBe(expected)
    }
  )
})

// ─── canAdminTransition ──────────────────────────────────────────────────────

describe('canAdminTransition', () => {
  const cases: [TeacherAttendanceStatus, TeacherAttendanceStatus, boolean][] = [
    // EXPECTED — admin can set concrete outcomes; CLOSED is system-only
    ['EXPECTED', 'PRESENT', true],
    ['EXPECTED', 'LATE', true],
    ['EXPECTED', 'ABSENT', true],
    ['EXPECTED', 'CLOSED', false],
    ['EXPECTED', 'EXCUSED', false],
    ['EXPECTED', 'EXPECTED', false],
    // PRESENT — admin can correct to ABSENT or LATE
    ['PRESENT', 'ABSENT', true],
    ['PRESENT', 'LATE', true],
    ['PRESENT', 'EXCUSED', false],
    ['PRESENT', 'CLOSED', false],
    ['PRESENT', 'PRESENT', false],
    // LATE — full admin authority including LATE→LATE (edit clockInTime)
    ['LATE', 'ABSENT', true],
    ['LATE', 'EXCUSED', true],
    ['LATE', 'PRESENT', true],
    ['LATE', 'LATE', true],
    ['LATE', 'CLOSED', false],
    ['LATE', 'EXPECTED', false],
    // ABSENT — admin can promote to present or excuse
    ['ABSENT', 'LATE', true],
    ['ABSENT', 'EXCUSED', true],
    ['ABSENT', 'PRESENT', true],
    ['ABSENT', 'CLOSED', false],
    ['ABSENT', 'ABSENT', false],
    // EXCUSED — admin reverts an erroneously approved excuse
    ['EXCUSED', 'LATE', true],
    ['EXCUSED', 'ABSENT', true],
    ['EXCUSED', 'PRESENT', false],
    ['EXCUSED', 'CLOSED', false],
    ['EXCUSED', 'EXCUSED', false],
    // CLOSED — admin confirms a physically-present teacher on a closed day
    ['CLOSED', 'PRESENT', true],
    ['CLOSED', 'LATE', false],
    ['CLOSED', 'ABSENT', false],
    ['CLOSED', 'EXPECTED', false],
    ['CLOSED', 'EXCUSED', false],
  ]

  it.each(cases)('from %s → %s = %s', (from, to, expected) => {
    expect(canAdminTransition(from, to)).toBe(expected)
  })
})

// ─── canSystemTransition ─────────────────────────────────────────────────────

describe('canSystemTransition — closure_mark', () => {
  const cases: [TeacherAttendanceStatus, TeacherAttendanceStatus, boolean][] = [
    ['EXPECTED', 'CLOSED', true],
    ['EXPECTED', 'ABSENT', false],
    ['PRESENT', 'CLOSED', false],
    ['LATE', 'CLOSED', false],
    ['ABSENT', 'CLOSED', false],
    ['EXCUSED', 'CLOSED', false],
  ]

  it.each(cases)('from %s → %s = %s', (from, to, expected) => {
    expect(canSystemTransition(from, to, 'closure_mark')).toBe(expected)
  })
})

describe('canSystemTransition — excuse_approval', () => {
  const cases: [TeacherAttendanceStatus, TeacherAttendanceStatus, boolean][] = [
    ['LATE', 'EXCUSED', true],
    ['ABSENT', 'EXCUSED', true],
    ['EXPECTED', 'EXCUSED', false],
    ['PRESENT', 'EXCUSED', false],
    ['CLOSED', 'EXCUSED', false],
    ['EXCUSED', 'EXCUSED', false],
    ['LATE', 'PRESENT', false],
    ['ABSENT', 'PRESENT', false],
  ]

  it.each(cases)('from %s → %s = %s', (from, to, expected) => {
    expect(canSystemTransition(from, to, 'excuse_approval')).toBe(expected)
  })
})

// ─── assertAdminTransition ───────────────────────────────────────────────────

describe('assertAdminTransition', () => {
  it('does not throw for a valid admin transition', () => {
    expect(() => assertAdminTransition('EXPECTED', 'PRESENT')).not.toThrow()
    expect(() => assertAdminTransition('LATE', 'LATE')).not.toThrow()
    expect(() => assertAdminTransition('CLOSED', 'PRESENT')).not.toThrow()
  })

  it('throws ActionError with INVALID_TRANSITION for an invalid admin transition', () => {
    expect(() => assertAdminTransition('EXPECTED', 'CLOSED')).toThrow(
      expect.objectContaining({ code: ERROR_CODES.INVALID_TRANSITION })
    )
  })

  it('includes from and to statuses in the error message', () => {
    expect(() => assertAdminTransition('EXCUSED', 'PRESENT')).toThrow(
      /EXCUSED.*PRESENT/
    )
  })

  it('includes the allowed transitions in the error message', () => {
    expect(() => assertAdminTransition('CLOSED', 'LATE')).toThrow(/PRESENT/)
  })
})

// ─── assertSystemTransition ──────────────────────────────────────────────────

describe('assertSystemTransition', () => {
  it('does not throw for closure_mark EXPECTED → CLOSED', () => {
    expect(() =>
      assertSystemTransition('EXPECTED', 'CLOSED', 'closure_mark')
    ).not.toThrow()
  })

  it('does not throw for excuse_approval LATE → EXCUSED', () => {
    expect(() =>
      assertSystemTransition('LATE', 'EXCUSED', 'excuse_approval')
    ).not.toThrow()
  })

  it('does not throw for excuse_approval ABSENT → EXCUSED', () => {
    expect(() =>
      assertSystemTransition('ABSENT', 'EXCUSED', 'excuse_approval')
    ).not.toThrow()
  })

  it('throws ActionError with INVALID_TRANSITION for an invalid system transition', () => {
    expect(() =>
      assertSystemTransition('PRESENT', 'CLOSED', 'closure_mark')
    ).toThrow(expect.objectContaining({ code: ERROR_CODES.INVALID_TRANSITION }))
  })

  it('includes the action name in the error message', () => {
    expect(() =>
      assertSystemTransition('EXPECTED', 'ABSENT', 'closure_mark')
    ).toThrow(/closure_mark/)
  })

  it('includes from and to statuses in the error message', () => {
    expect(() =>
      assertSystemTransition('PRESENT', 'EXCUSED', 'excuse_approval')
    ).toThrow(/PRESENT.*EXCUSED/)
  })
})

// ─── getAdminAllowedTransitions ──────────────────────────────────────────────

describe('getAdminAllowedTransitions', () => {
  it('returns correct set for EXPECTED (excludes CLOSED)', () => {
    const result = getAdminAllowedTransitions('EXPECTED')
    expect(result).toEqual(
      expect.arrayContaining(['PRESENT', 'LATE', 'ABSENT'])
    )
    expect(result).not.toContain('CLOSED')
    expect(result).toHaveLength(3)
  })

  it('returns correct set for PRESENT', () => {
    expect(getAdminAllowedTransitions('PRESENT')).toEqual(
      expect.arrayContaining(['ABSENT', 'LATE'])
    )
    expect(getAdminAllowedTransitions('PRESENT')).toHaveLength(2)
  })

  it('returns correct set for LATE (includes self-loop)', () => {
    const result = getAdminAllowedTransitions('LATE')
    expect(result).toEqual(
      expect.arrayContaining(['ABSENT', 'EXCUSED', 'PRESENT', 'LATE'])
    )
    expect(result).toHaveLength(4)
  })

  it('returns correct set for ABSENT', () => {
    const absent = getAdminAllowedTransitions('ABSENT')
    expect(absent).toEqual(
      expect.arrayContaining(['LATE', 'EXCUSED', 'PRESENT'])
    )
    expect(absent).toHaveLength(3)
  })

  it('returns correct set for EXCUSED', () => {
    expect(getAdminAllowedTransitions('EXCUSED')).toEqual(
      expect.arrayContaining(['LATE', 'ABSENT'])
    )
    expect(getAdminAllowedTransitions('EXCUSED')).toHaveLength(2)
  })

  it('returns correct set for CLOSED', () => {
    expect(getAdminAllowedTransitions('CLOSED')).toEqual(['PRESENT'])
  })
})

// ─── PRESENT→EXCUSED removal regression guards ───────────────────────────────

describe('PRESENT→EXCUSED removal (regression guards)', () => {
  it('canAdminTransition PRESENT→EXCUSED returns false', () => {
    expect(canAdminTransition('PRESENT', 'EXCUSED')).toBe(false)
  })

  it('getAdminAllowedTransitions PRESENT does not include EXCUSED', () => {
    expect(getAdminAllowedTransitions('PRESENT')).not.toContain('EXCUSED')
  })

  it('canAdminTransition LATE→EXCUSED returns true (EXCUSED valid from LATE)', () => {
    expect(canAdminTransition('LATE', 'EXCUSED')).toBe(true)
  })

  it('canAdminTransition ABSENT→EXCUSED returns true (EXCUSED valid from ABSENT)', () => {
    expect(canAdminTransition('ABSENT', 'EXCUSED')).toBe(true)
  })
})
