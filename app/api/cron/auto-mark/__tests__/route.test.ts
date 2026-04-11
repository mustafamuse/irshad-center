/**
 * Auto-mark Cron Route Tests
 *
 * Covers: auth validation, weekday guard, both-shifts success (200),
 * one-shift failure (207), and both-shifts failure (500).
 */

import { formatInTimeZone } from 'date-fns-tz'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const { mockHeaders, mockAutoMarkBothShifts, mockLogError } = vi.hoisted(
  () => ({
    mockHeaders: vi.fn(),
    mockAutoMarkBothShifts: vi.fn(),
    mockLogError: vi.fn(),
  })
)

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

vi.mock('date-fns-tz', async (importOriginal) => {
  const actual = await importOriginal<typeof import('date-fns-tz')>()
  return {
    ...actual,
    formatInTimeZone: vi.fn(),
  }
})

vi.mock('@/lib/services/dugsi/auto-mark-service', () => ({
  autoMarkBothShifts: (...args: unknown[]) => mockAutoMarkBothShifts(...args),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
  logError: (...args: unknown[]) => mockLogError(...args),
}))

import { GET } from '../route'

const mockFormatInTimeZone = formatInTimeZone as ReturnType<typeof vi.fn>

// Stable AutoMarkResult fixtures
const MORNING_RESULT = {
  shift: 'MORNING' as const,
  date: '2026-01-03',
  marked: 2,
}
const AFTERNOON_RESULT = {
  shift: 'AFTERNOON' as const,
  date: '2026-01-03',
  marked: 1,
}

function makeHeaders(authValue: string | null) {
  return Promise.resolve({
    get: (name: string) => (name === 'authorization' ? authValue : null),
  })
}

describe('GET /api/cron/auto-mark', () => {
  const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    // Default: a Saturday (2026-01-03 → getUTCDay() = 6)
    mockFormatInTimeZone.mockReturnValue('2026-01-03')
    mockHeaders.mockReturnValue(makeHeaders('Bearer test-secret'))
    mockAutoMarkBothShifts.mockResolvedValue({
      morning: MORNING_RESULT,
      afternoon: AFTERNOON_RESULT,
    })
  })

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_CRON_SECRET
  })

  // ─── Auth ────────────────────────────────────────────────────────────────

  it('returns 401 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET
    const res = await GET()
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' })
    expect(mockAutoMarkBothShifts).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header is missing', async () => {
    mockHeaders.mockReturnValue(makeHeaders(null))
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockAutoMarkBothShifts).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header has wrong secret', async () => {
    mockHeaders.mockReturnValue(makeHeaders('Bearer wrong-secret'))
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockAutoMarkBothShifts).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header has wrong format (no Bearer prefix)', async () => {
    mockHeaders.mockReturnValue(makeHeaders('test-secret'))
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockAutoMarkBothShifts).not.toHaveBeenCalled()
  })

  // ─── Weekday guard ────────────────────────────────────────────────────────

  it('skips on a weekday (Monday)', async () => {
    // 2026-01-05 is a Monday (getUTCDay() = 1)
    mockFormatInTimeZone.mockReturnValue('2026-01-05')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ skipped: 'not_a_school_day' })
    expect(mockAutoMarkBothShifts).not.toHaveBeenCalled()
  })

  it('skips on a weekday (Friday)', async () => {
    // 2026-01-09 is a Friday (getUTCDay() = 5)
    mockFormatInTimeZone.mockReturnValue('2026-01-09')
    const res = await GET()
    expect(await res.json()).toMatchObject({ skipped: 'not_a_school_day' })
    expect(mockAutoMarkBothShifts).not.toHaveBeenCalled()
  })

  it('runs on Saturday', async () => {
    // 2026-01-03 is a Saturday (getUTCDay() = 6)
    mockFormatInTimeZone.mockReturnValue('2026-01-03')
    await GET()
    expect(mockAutoMarkBothShifts).toHaveBeenCalledWith('2026-01-03')
  })

  it('runs on Sunday', async () => {
    // 2026-01-04 is a Sunday (getUTCDay() = 0)
    mockFormatInTimeZone.mockReturnValue('2026-01-04')
    await GET()
    expect(mockAutoMarkBothShifts).toHaveBeenCalledWith('2026-01-04')
  })

  // ─── Success responses ────────────────────────────────────────────────────

  it('returns 200 when both shifts succeed', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      date: '2026-01-03',
      morning: MORNING_RESULT,
      afternoon: AFTERNOON_RESULT,
    })
  })

  // ─── Partial failure (207) ────────────────────────────────────────────────

  it('returns 207 when morning shift fails (null)', async () => {
    mockAutoMarkBothShifts.mockResolvedValue({
      morning: null,
      afternoon: AFTERNOON_RESULT,
    })
    const res = await GET()
    expect(res.status).toBe(207)
    const body = await res.json()
    expect(body.morning).toBeNull()
    expect(body.afternoon).toEqual(AFTERNOON_RESULT)
  })

  it('returns 207 when afternoon shift fails (null)', async () => {
    mockAutoMarkBothShifts.mockResolvedValue({
      morning: MORNING_RESULT,
      afternoon: null,
    })
    const res = await GET()
    expect(res.status).toBe(207)
    const body = await res.json()
    expect(body.morning).toEqual(MORNING_RESULT)
    expect(body.afternoon).toBeNull()
  })

  // ─── Total failure (500) ──────────────────────────────────────────────────

  it('returns 500 when both shifts throw (autoMarkBothShifts rejects)', async () => {
    mockAutoMarkBothShifts.mockRejectedValue(
      new Error('Both MORNING and AFTERNOON auto-mark shifts failed')
    )
    const res = await GET()
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'Internal server error' })
    expect(mockLogError).toHaveBeenCalled()
  })
})
