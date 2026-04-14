import { NextRequest } from 'next/server'

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const {
  mockCheckRateLimit,
  mockIsTeacherEnrolledInDugsi,
  mockGenerateTeacherToken,
  mockLogError,
  mockPhase2Enabled,
} = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockIsTeacherEnrolledInDugsi: vi.fn(),
  mockGenerateTeacherToken: vi.fn(),
  mockLogError: vi.fn(),
  mockPhase2Enabled: { value: true },
}))

vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock('@/lib/auth/teacher-session', () => ({
  generateTeacherToken: (...args: unknown[]) =>
    mockGenerateTeacherToken(...args),
}))

vi.mock('@/lib/db/queries/teacher-checkin', () => ({
  isTeacherEnrolledInDugsi: (...args: unknown[]) =>
    mockIsTeacherEnrolledInDugsi(...args),
}))

vi.mock('@/lib/feature-flags', () => ({
  get PHASE2_EXCUSE_ENABLED() {
    return mockPhase2Enabled.value
  },
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

import { POST } from '../route'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001'
const CORRECT_PIN = 'school-pin-123'

function makeRequest(body: unknown, ip?: string): NextRequest {
  return new NextRequest('http://localhost/api/teacher/checkin/session', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
  })
}

describe('POST /api/teacher/checkin/session', () => {
  beforeEach(() => {
    mockPhase2Enabled.value = true
    process.env.TEACHER_CHECKIN_PIN = CORRECT_PIN
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 4,
      reset: 0,
    })
    mockIsTeacherEnrolledInDugsi.mockResolvedValue(true)
    mockGenerateTeacherToken.mockReturnValue('signed-token-abc')
    mockLogError.mockResolvedValue(undefined)
  })

  afterEach(() => {
    delete process.env.TEACHER_CHECKIN_PIN
  })

  it('returns 403 when Phase 2 is disabled', async () => {
    mockPhase2Enabled.value = false
    const res = await POST(
      makeRequest({ teacherId: VALID_UUID, pin: CORRECT_PIN })
    )
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('Feature not available')
  })

  it('returns 400 for invalid body (non-UUID teacherId)', async () => {
    const res = await POST(
      makeRequest({ teacherId: 'not-a-uuid', pin: CORRECT_PIN })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid body (empty pin)', async () => {
    const res = await POST(makeRequest({ teacherId: VALID_UUID, pin: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 900000,
    })
    const res = await POST(
      makeRequest({ teacherId: VALID_UUID, pin: CORRECT_PIN }, '1.2.3.4')
    )
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toMatch(/too many requests/i)
  })

  it('returns 500 when TEACHER_CHECKIN_PIN env var is missing', async () => {
    delete process.env.TEACHER_CHECKIN_PIN
    const res = await POST(
      makeRequest({ teacherId: VALID_UUID, pin: CORRECT_PIN })
    )
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Server misconfiguration')
    expect(mockLogError).toHaveBeenCalledOnce()
  })

  it('returns 401 when teacher is not enrolled', async () => {
    mockIsTeacherEnrolledInDugsi.mockResolvedValue(false)
    const res = await POST(
      makeRequest({ teacherId: VALID_UUID, pin: CORRECT_PIN })
    )
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Teacher not found')
  })

  it('returns 401 for wrong PIN', async () => {
    const res = await POST(
      makeRequest({ teacherId: VALID_UUID, pin: 'wrong-pin' })
    )
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Invalid PIN')
  })

  it('returns 200 with token for correct PIN and valid teacher', async () => {
    const res = await POST(
      makeRequest({ teacherId: VALID_UUID, pin: CORRECT_PIN }, '10.0.0.1')
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.token).toBe('signed-token-abc')
    expect(mockGenerateTeacherToken).toHaveBeenCalledWith(VALID_UUID)
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      `session:10.0.0.1:${VALID_UUID}`
    )
  })
})
