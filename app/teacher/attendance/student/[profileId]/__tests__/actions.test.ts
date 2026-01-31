import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-teacher', () => ({
  getAuthenticatedTeacherId: vi.fn(),
}))
vi.mock('@/lib/db/queries/teacher-students', () => ({
  getTeacherClassIds: vi.fn(),
  getStudentProfile: vi.fn(),
  getStudentAttendanceRecords: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  createActionLogger: () => ({ info: vi.fn(), error: vi.fn() }),
  logError: vi.fn(),
}))

import { getAuthenticatedTeacherId } from '@/lib/auth/get-teacher'
import {
  getTeacherClassIds,
  getStudentProfile,
  getStudentAttendanceRecords,
} from '@/lib/db/queries/teacher-students'

import { loadMoreStudentHistory } from '../actions'

const mockAuth = vi.mocked(getAuthenticatedTeacherId)
const mockClassIds = vi.mocked(getTeacherClassIds)
const mockProfile = vi.mocked(getStudentProfile)
const mockRecords = vi.mocked(getStudentAttendanceRecords)

const validId = '00000000-0000-0000-0000-000000000001'

describe('loadMoreStudentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue('teacher-1')
  })

  it('valid teacher + valid student returns data', async () => {
    mockProfile.mockResolvedValue({
      profileId: validId,
      name: 'Ali',
      className: 'A',
      shift: 'MORNING',
      classId: 'class-1',
    })
    mockClassIds.mockResolvedValue(['class-1'])
    mockRecords.mockResolvedValue({
      data: [],
      hasMore: false,
      total: 0,
    })

    const result = await loadMoreStudentHistory(validId, 0)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ data: [], hasMore: false, total: 0 })
    }
  })

  it('student NOT in teacher classes returns error', async () => {
    mockProfile.mockResolvedValue({
      profileId: validId,
      name: 'Ali',
      className: 'A',
      shift: 'MORNING',
      classId: 'class-999',
    })
    mockClassIds.mockResolvedValue(['class-1'])

    const result = await loadMoreStudentHistory(validId, 0)
    expect(result.success).toBe(false)
  })

  it('student not found returns error', async () => {
    mockProfile.mockResolvedValue(null)

    const result = await loadMoreStudentHistory(validId, 0)
    expect(result.success).toBe(false)
  })

  it('invalid profileId returns validation error', async () => {
    const result = await loadMoreStudentHistory('not-uuid', 0)
    expect(result.success).toBe(false)
  })
})
