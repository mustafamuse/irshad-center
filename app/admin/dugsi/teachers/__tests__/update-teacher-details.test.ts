import { vi, describe, it, expect, beforeEach } from 'vitest' // eslint-disable-line import/order

const {
  mockTeacherFindUnique,
  mockPersonUpdate,
  mockGetTeachers,
  mockAssertAdmin,
} = vi.hoisted(() => ({
  mockTeacherFindUnique: vi.fn(),
  mockPersonUpdate: vi.fn(),
  mockGetTeachers: vi.fn(),
  mockAssertAdmin: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    teacher: {
      findUnique: (...args: unknown[]) => mockTeacherFindUnique(...args),
    },
    person: {
      update: (...args: unknown[]) => mockPersonUpdate(...args),
    },
  },
}))

vi.mock('@/lib/services/shared/teacher-service', () => ({
  getAllTeachers: (...args: unknown[]) => mockGetTeachers(...args),
  createTeacher: vi.fn(),
  deleteTeacher: vi.fn(),
  assignTeacherToProgram: vi.fn(),
  removeTeacherFromProgram: vi.fn(),
  bulkAssignPrograms: vi.fn(),
  getTeacherPrograms: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
  logError: vi.fn(),
}))

vi.mock('@/lib/services/validation-service', () => ({
  ValidationError: class extends Error {
    code: string
    constructor(msg: string, code: string) {
      super(msg)
      this.code = code
    }
  },
}))

vi.mock('@/lib/db/queries/teacher-checkin', () => ({
  getAllDugsiTeachersWithTodayStatus: vi.fn(),
  getCheckinHistory: vi.fn(),
  getCheckinsForDate: vi.fn(),
  getLateArrivals: vi.fn(),
  getDugsiTeachersForDropdown: vi.fn(),
}))

vi.mock('@/lib/services/dugsi/teacher-checkin-service', () => ({
  updateCheckin: vi.fn(),
  deleteCheckin: vi.fn(),
}))

vi.mock('@/lib/mappers/person-mapper', () => ({
  mapPersonToSearchResult: vi.fn(),
  PersonSearchResult: {},
}))

vi.mock('@/lib/auth', () => ({
  assertAdmin: (...args: unknown[]) => mockAssertAdmin(...args),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { updateTeacherDetailsAction } from '../actions'

const mockTeacher = {
  id: 'teacher-1',
  personId: 'person-1',
  person: {
    id: 'person-1',
    name: 'Ahmed Hassan',
    email: 'ahmed@school.org',
    phone: '6125551234',
  },
}

const mockUpdatedTeacher = {
  id: 'teacher-1',
  personId: 'person-1',
  name: 'Ahmed Hassan',
  email: 'ahmed@school.org',
  phone: '6125551234',
  programs: [],
  classCount: 0,
  shifts: [],
  morningCheckin: null,
  afternoonCheckin: null,
  createdAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockTeacherFindUnique.mockResolvedValue(mockTeacher)
  mockPersonUpdate.mockResolvedValue(mockTeacher.person)
  mockGetTeachers.mockResolvedValue({
    success: true,
    data: [mockUpdatedTeacher],
  })
})

describe('updateTeacherDetailsAction', () => {
  it('should reject invalid input via Zod', async () => {
    const result = await updateTeacherDetailsAction({
      teacherId: 'not-a-uuid',
      name: '',
    })

    expect(result.success).toBe(false)
    expect(mockTeacherFindUnique).not.toHaveBeenCalled()
  })

  it('should update name only when email/phone omitted', async () => {
    await updateTeacherDetailsAction({
      teacherId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'New Name',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'New Name' },
      })
    )
  })

  it('should NOT clear email when not provided (undefined skips)', async () => {
    await updateTeacherDetailsAction({
      teacherId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'New Name',
    })

    const updateCall = mockPersonUpdate.mock.calls[0]?.[0]
    expect(updateCall?.data).not.toHaveProperty('email')
    expect(updateCall?.data).not.toHaveProperty('phone')
  })

  it('should clear email when empty string provided', async () => {
    await updateTeacherDetailsAction({
      teacherId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'New Name',
      email: '',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: null }),
      })
    )
  })

  it('should normalize email to lowercase', async () => {
    await updateTeacherDetailsAction({
      teacherId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'New Name',
      email: 'AHMED@School.ORG',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'ahmed@school.org' }),
      })
    )
  })

  it('should normalize phone to 10 digits', async () => {
    await updateTeacherDetailsAction({
      teacherId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'New Name',
      phone: '612-555-9999',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '6125559999' }),
      })
    )
  })

  it('should return P2002 error for duplicate contact', async () => {
    const { Prisma } = await import('@prisma/client')
    mockPersonUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      })
    )

    const result = await updateTeacherDetailsAction({
      teacherId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'New Name',
      email: 'taken@example.com',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('already in use')
  })

  it('should return error when teacher not found', async () => {
    mockTeacherFindUnique.mockResolvedValue(null)

    const result = await updateTeacherDetailsAction({
      teacherId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'New Name',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Teacher not found')
  })
})
