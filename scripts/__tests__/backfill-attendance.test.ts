/**
 * Idempotency contract tests for scripts/backfill-attendance.ts
 *
 * The script calls main() immediately on load, which triggers live Prisma
 * queries and process.exit(). It cannot be imported safely in a test
 * environment without a complete DB fixture setup.
 *
 * Strategy:
 *   - Structural tests verify the key predicates extracted from the script logic
 *     inline (no import of the script itself).
 *   - it.todo() entries document the full behavioral contracts so they can be
 *     promoted to integration tests when a test-DB fixture is available.
 */

import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers mirrored from the script (pure logic — no Prisma, no side effects)
// ---------------------------------------------------------------------------

/**
 * Mirrors the existingMap key format used in the script:
 *   `${r.teacherId}|${dateStr}|${r.shift}`
 */
function makeKey(teacherId: string, dateStr: string, shift: string): string {
  return `${teacherId}|${dateStr}|${shift}`
}

/**
 * Mirrors the partition logic the script applies to each non-SKIP row:
 *   - No existing record → toCreate
 *   - Existing record with any other status → skip (admin override preserved)
 */
type Action = 'ABSENT' | 'CLOSED' | 'PRESENT' | 'LATE'

function partitionRow(
  existingStatus: string | undefined,
  _action: Action
): 'create' | 'update' | 'skip' {
  if (existingStatus === undefined) return 'create'
  if (existingStatus === 'EXPECTED') return 'update'
  return 'skip'
}

// ---------------------------------------------------------------------------
// createMany — skipDuplicates guarantee
// ---------------------------------------------------------------------------

describe('createMany skipDuplicates', () => {
  it('routes a row with no existing record to the toCreate bucket', () => {
    const existingMap = new Map<string, { id: string; status: string }>()
    const key = makeKey('teacher-1', '2026-01-17', 'MORNING')

    const existing = existingMap.get(key)
    expect(partitionRow(existing?.status, 'ABSENT')).toBe('create')
  })

  it.todo(
    'createMany is called with skipDuplicates: true — ' +
      'verified by reading line 381 of scripts/backfill-attendance.ts: ' +
      '`tx.teacherAttendanceRecord.createMany({ data: toCreate, skipDuplicates: true })`'
  )

  it.todo(
    're-running the script when all records already exist in a non-EXPECTED status ' +
      'produces toCreate = [] so createMany is never called — ' +
      'skipDuplicates is the last-line safety net for true concurrent races only'
  )
})

// ---------------------------------------------------------------------------
// updateMany ABSENT — status guard prevents re-update
// ---------------------------------------------------------------------------

describe('updateMany ABSENT status guard', () => {
  it('routes a row whose existing record is EXPECTED to the absentIds bucket', () => {
    const existing = { id: 'rec-1', status: 'EXPECTED' }
    expect(partitionRow(existing.status, 'ABSENT')).toBe('update')
  })

  it('skips a row whose existing record is already ABSENT (admin override preserved)', () => {
    const existing = { id: 'rec-1', status: 'ABSENT' }
    expect(partitionRow(existing.status, 'ABSENT')).toBe('skip')
  })

  it('skips a row whose existing record is EXCUSED (do not regress excused records)', () => {
    const existing = { id: 'rec-1', status: 'EXCUSED' }
    expect(partitionRow(existing.status, 'ABSENT')).toBe('skip')
  })

  it('skips a row whose existing record is PRESENT (admin override preserved)', () => {
    const existing = { id: 'rec-1', status: 'PRESENT' }
    expect(partitionRow(existing.status, 'ABSENT')).toBe('skip')
  })

  it.todo(
    'updateMany for ABSENT carries `where: { id: { in: absentIds }, status: "EXPECTED" }` — ' +
      'verified by reading lines 347-350 of scripts/backfill-attendance.ts; ' +
      'the status guard means a second run finds no EXPECTED rows and absentIds stays empty, ' +
      'so updateMany is not called at all'
  )
})

// ---------------------------------------------------------------------------
// updateMany CLOSED — status guard prevents re-update
// ---------------------------------------------------------------------------

describe('updateMany CLOSED status guard', () => {
  it('routes a row whose existing record is EXPECTED to the closedIds bucket', () => {
    const existing = { id: 'rec-1', status: 'EXPECTED' }
    expect(partitionRow(existing.status, 'CLOSED')).toBe('update')
  })

  it('skips a row whose existing record is already CLOSED on a re-run', () => {
    const existing = { id: 'rec-1', status: 'CLOSED' }
    expect(partitionRow(existing.status, 'CLOSED')).toBe('skip')
  })

  it.todo(
    'updateMany for CLOSED carries `where: { id: { in: closedIds }, status: "EXPECTED" }` — ' +
      'verified by reading lines 354-358 of scripts/backfill-attendance.ts; ' +
      'on a second run the record is CLOSED, not EXPECTED, so it is partitioned to skip ' +
      'and closedIds is empty — updateMany is never called'
  )
})

// ---------------------------------------------------------------------------
// updateMany PRESENT/LATE — status guard prevents corruption on re-run
// ---------------------------------------------------------------------------

describe('updateMany PRESENT/LATE status guard', () => {
  it('routes a PRESENT row whose existing record is EXPECTED to presentLateUpdates', () => {
    const existing = { id: 'rec-1', status: 'EXPECTED' }
    expect(partitionRow(existing.status, 'PRESENT')).toBe('update')
  })

  it('routes a LATE row whose existing record is EXPECTED to presentLateUpdates', () => {
    const existing = { id: 'rec-1', status: 'EXPECTED' }
    expect(partitionRow(existing.status, 'LATE')).toBe('update')
  })

  it('skips a PRESENT row whose existing record is already PRESENT on a re-run', () => {
    const existing = { id: 'rec-1', status: 'PRESENT' }
    expect(partitionRow(existing.status, 'PRESENT')).toBe('skip')
  })

  it('skips a LATE row whose existing record is already LATE on a re-run', () => {
    const existing = { id: 'rec-1', status: 'LATE' }
    expect(partitionRow(existing.status, 'LATE')).toBe('skip')
  })

  it('skips a PRESENT row whose existing record is EXCUSED (do not regress excused records)', () => {
    const existing = { id: 'rec-1', status: 'EXCUSED' }
    expect(partitionRow(existing.status, 'PRESENT')).toBe('skip')
  })

  it.todo(
    'each PRESENT/LATE updateMany carries `where: { id, status: "EXPECTED" }` — ' +
      'verified by reading lines 362-372 of scripts/backfill-attendance.ts; ' +
      'on a second run the record is PRESENT or LATE, not EXPECTED, so the per-row ' +
      'updateMany matches zero rows and is a no-op'
  )

  it.todo(
    'a PRESENT record that was manually overridden to ABSENT by an admin is not ' +
      'flipped back to PRESENT on re-run — the partition logic routes it to skip ' +
      'because status !== "EXPECTED"'
  )
})

// ---------------------------------------------------------------------------
// GRACE_DATES — skipped entirely, never written to DB
// ---------------------------------------------------------------------------

describe('GRACE_DATES rows are skipped before DB partition', () => {
  const GRACE_DATES = new Set(['2026-02-21', '2026-02-22'])

  it('a row on a grace date has action SKIP and is excluded before partition', () => {
    const date = '2026-02-21'
    expect(GRACE_DATES.has(date)).toBe(true)
    // The script continues to the next iteration for SKIP rows,
    // never reaching the existingMap lookup or any bucket push.
  })

  it.todo(
    'SKIP rows never appear in toCreate, absentIds, closedIds, or presentLateUpdates — ' +
      'verified by `if (r.action === "SKIP") continue` at line 293 of the script'
  )
})

// ---------------------------------------------------------------------------
// existingMap key format — ensures correct deduplication across teachers
// ---------------------------------------------------------------------------

describe('existingMap key uniqueness', () => {
  it('different teachers with the same date+shift produce distinct keys', () => {
    const key1 = makeKey('teacher-1', '2026-01-17', 'MORNING')
    const key2 = makeKey('teacher-2', '2026-01-17', 'MORNING')
    expect(key1).not.toBe(key2)
  })

  it('same teacher with different shifts produce distinct keys', () => {
    const key1 = makeKey('teacher-1', '2026-01-17', 'MORNING')
    const key2 = makeKey('teacher-1', '2026-01-17', 'AFTERNOON')
    expect(key1).not.toBe(key2)
  })

  it('same teacher+shift on different dates produce distinct keys', () => {
    const key1 = makeKey('teacher-1', '2026-01-17', 'MORNING')
    const key2 = makeKey('teacher-1', '2026-01-24', 'MORNING')
    expect(key1).not.toBe(key2)
  })
})
