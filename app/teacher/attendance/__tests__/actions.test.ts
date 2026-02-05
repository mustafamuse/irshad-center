import { revalidatePath, revalidateTag } from 'next/cache'

import { describe, expect, it, vi, beforeEach } from 'vitest'

import { getAuthenticatedTeacherId } from '@/lib/auth/get-teacher'
import { getSessionById } from '@/lib/db/queries/dugsi-attendance'
import { logError } from '@/lib/logger'
import { markAttendanceRecords } from '@/lib/services/dugsi/attendance-service'
import { ValidationError } from '@/lib/services/validation-service'

import { teacherMarkAttendance } from '../actions'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('@/lib/auth/get-teacher', () => ({
  getAuthenticatedTeacherId: vi.fn(),
}))
vi.mock('@/lib/db/queries/dugsi-attendance', () => ({
  getSessionById: vi.fn(),
}))
vi.mock('@/lib/services/dugsi/attendance-service', () => ({
  markAttendanceRecords: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  createActionLogger: () => ({ info: vi.fn(), error: vi.fn() }),
  createServiceLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  logError: vi.fn(),
}))

const mockAuth = vi.mocked(getAuthenticatedTeacherId)
const mockSession = vi.mocked(getSessionById)
const mockMark = vi.mocked(markAttendanceRecords)
const mockRevalidatePath = vi.mocked(revalidatePath)
const mockRevalidateTag = vi.mocked(revalidateTag)
const mockLogError = vi.mocked(logError)

const validId = '00000000-0000-0000-0000-000000000001'

describe('teacherMarkAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue('teacher-1')
  })

  it('valid input + teacher owns session returns success', async () => {
    mockSession.mockResolvedValue({ teacherId: 'teacher-1' } as Awaited<
      ReturnType<typeof getSessionById>
    >)
    mockMark.mockResolvedValue({ recordCount: 5 })

    const result = await teacherMarkAttendance({
      sessionId: validId,
      records: [{ programProfileId: validId, status: 'PRESENT' }],
    })

    expect(result).toEqual({ success: true, data: { recordCount: 5 } })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/teacher/attendance')
    expect(mockRevalidateTag).toHaveBeenCalledWith('attendance-stats')
  })

  it('invalid input returns validation error', async () => {
    const result = await teacherMarkAttendance({ sessionId: 'bad' })
    expect(result.success).toBe(false)
  })

  it('teacher does NOT own session returns unauthorized', async () => {
    mockSession.mockResolvedValue({ teacherId: 'other-teacher' } as Awaited<
      ReturnType<typeof getSessionById>
    >)

    const result = await teacherMarkAttendance({
      sessionId: validId,
      records: [{ programProfileId: validId, status: 'PRESENT' }],
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Unauthorized')
  })

  it('session not found returns unauthorized', async () => {
    mockSession.mockResolvedValue(null)

    const result = await teacherMarkAttendance({
      sessionId: validId,
      records: [{ programProfileId: validId, status: 'PRESENT' }],
    })

    expect(result.success).toBe(false)
  })

  it('ValidationError returns error message', async () => {
    mockSession.mockResolvedValue({ teacherId: 'teacher-1' } as Awaited<
      ReturnType<typeof getSessionById>
    >)
    mockMark.mockRejectedValue(
      new ValidationError('Session closed', 'SESSION_CLOSED')
    )

    const result = await teacherMarkAttendance({
      sessionId: validId,
      records: [{ programProfileId: validId, status: 'PRESENT' }],
    })

    expect(result).toEqual({ success: false, error: 'Session closed' })
  })

  it('generic error returns generic message and logs', async () => {
    mockSession.mockResolvedValue({ teacherId: 'teacher-1' } as Awaited<
      ReturnType<typeof getSessionById>
    >)
    mockMark.mockRejectedValue(new Error('db crash'))

    const result = await teacherMarkAttendance({
      sessionId: validId,
      records: [{ programProfileId: validId, status: 'PRESENT' }],
    })

    expect(result).toEqual({
      success: false,
      error: 'Failed to mark attendance',
    })
    expect(mockLogError).toHaveBeenCalled()
  })
})
