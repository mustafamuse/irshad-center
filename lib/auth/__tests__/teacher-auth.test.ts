import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/queries/teacher', () => ({
  findTeachersByPhoneLastFour: vi.fn(),
}))

import { findTeachersByPhoneLastFour } from '@/lib/db/queries/teacher'

import {
  authenticateTeacher,
  generateTeacherAuthToken,
  verifyTeacherAuthToken,
} from '../teacher-auth'

const mockFind = vi.mocked(findTeachersByPhoneLastFour)

describe('authenticateTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('single match returns teacher info', async () => {
    mockFind.mockResolvedValue([
      { id: 't1', personId: 'p1', person: { name: 'Ali' } },
    ] as Awaited<ReturnType<typeof findTeachersByPhoneLastFour>>)
    const result = await authenticateTeacher('1234')
    expect(result).toEqual({ teacherId: 't1', teacherName: 'Ali' })
  })

  it('no match returns null', async () => {
    mockFind.mockResolvedValue([])
    expect(await authenticateTeacher('0000')).toBeNull()
  })

  it('multiple matches returns null', async () => {
    mockFind.mockResolvedValue([
      { id: 't1', personId: 'p1', person: { name: 'Ali' } },
      { id: 't2', personId: 'p2', person: { name: 'Omar' } },
    ] as Awaited<ReturnType<typeof findTeachersByPhoneLastFour>>)
    expect(await authenticateTeacher('1234')).toBeNull()
  })
})

describe('generateTeacherAuthToken', () => {
  beforeEach(() => {
    vi.stubEnv('TEACHER_AUTH_SECRET', 'test-secret-key')
  })

  it('returns string in format id.timestamp.signature', () => {
    const token = generateTeacherAuthToken('teacher-123')
    const parts = token.split('.')
    expect(parts.length).toBe(3)
    expect(parts[0]).toBe('teacher-123')
    expect(Number(parts[1])).not.toBeNaN()
    expect(parts[2].length).toBeGreaterThan(0)
  })

  it('different IDs produce different tokens', () => {
    const t1 = generateTeacherAuthToken('id-1')
    const t2 = generateTeacherAuthToken('id-2')
    expect(t1).not.toBe(t2)
  })
})

describe('verifyTeacherAuthToken', () => {
  beforeEach(() => {
    vi.stubEnv('TEACHER_AUTH_SECRET', 'test-secret-key')
  })

  it('valid token returns teacherId', () => {
    const token = generateTeacherAuthToken('teacher-abc')
    const result = verifyTeacherAuthToken(token)
    expect(result).toEqual({ teacherId: 'teacher-abc' })
  })

  it('expired token returns null', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01'))
    const token = generateTeacherAuthToken('t1')
    vi.setSystemTime(new Date('2024-01-03'))
    expect(verifyTeacherAuthToken(token)).toBeNull()
    vi.useRealTimers()
  })

  it('tampered signature returns null', () => {
    const token = generateTeacherAuthToken('t1')
    const parts = token.split('.')
    parts[2] = 'tampered'
    expect(verifyTeacherAuthToken(parts.join('.'))).toBeNull()
  })

  it('malformed token returns null', () => {
    expect(verifyTeacherAuthToken('only-one-part')).toBeNull()
    expect(verifyTeacherAuthToken('')).toBeNull()
  })

  it('future timestamp returns null', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-01'))
    const token = generateTeacherAuthToken('t1')
    vi.setSystemTime(new Date('2025-05-01'))
    expect(verifyTeacherAuthToken(token)).toBeNull()
    vi.useRealTimers()
  })
})
