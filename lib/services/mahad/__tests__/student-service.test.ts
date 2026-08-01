import { Prisma } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPersonUpdate,
  mockProgramProfileUpdate,
  mockEnrollmentUpdateMany,
  mockTransaction,
  mockGetProgramProfileById,
} = vi.hoisted(() => ({
  mockPersonUpdate: vi.fn(),
  mockProgramProfileUpdate: vi.fn(),
  mockEnrollmentUpdateMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetProgramProfileById: vi.fn(),
}))

const mockTx = {
  person: {
    update: (...args: unknown[]) => mockPersonUpdate(...args),
  },
  programProfile: {
    update: (...args: unknown[]) => mockProgramProfileUpdate(...args),
  },
  enrollment: {
    updateMany: (...args: unknown[]) => mockEnrollmentUpdateMany(...args),
  },
}

mockTransaction.mockImplementation(
  (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(mockTx)
)

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfileById: (...args: unknown[]) =>
    mockGetProgramProfileById(...args),
}))

vi.mock('@/lib/db/queries/siblings', () => ({
  getPersonSiblings: vi.fn(),
}))

vi.mock('@/lib/utils/contact-normalization', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/utils/contact-normalization')
  >('@/lib/utils/contact-normalization')
  return {
    normalizeEmail: actual.normalizeEmail,
    normalizePhone: actual.normalizePhone,
  }
})

import { ActionError } from '@/lib/errors/action-error'

import { deleteMahadStudent, updateMahadStudent } from '../student-service'

describe('updateMahadStudent', () => {
  const mockProfile = {
    id: 'profile-1',
    personId: 'person-1',
    program: 'MAHAD_PROGRAM',
    person: { id: 'person-1', name: 'Ahmed', email: null, phone: null },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProgramProfileById.mockResolvedValue(mockProfile)
    mockPersonUpdate.mockResolvedValue({ id: 'person-1' })
    mockProgramProfileUpdate.mockResolvedValue({ id: 'profile-1' })
    mockTransaction.mockImplementation(
      (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(mockTx)
    )
  })

  it('should wrap updates in $transaction when no client is passed', async () => {
    await updateMahadStudent('profile-1', { name: 'New Name' })

    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should update name directly on Person', async () => {
    await updateMahadStudent('profile-1', { name: 'New Name' })

    expect(mockPersonUpdate).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { name: 'New Name' },
    })
  })

  it('should update email directly on Person', async () => {
    await updateMahadStudent('profile-1', { email: 'new@test.com' })

    expect(mockPersonUpdate).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { email: 'new@test.com' },
    })
  })

  it('should update phone directly on Person with normalization', async () => {
    await updateMahadStudent('profile-1', { phone: '612-555-9999' })

    expect(mockPersonUpdate).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { phone: '6125559999' },
    })
  })

  it('should pass tx to getProgramProfileById', async () => {
    await updateMahadStudent('profile-1', { name: 'Test' })

    expect(mockGetProgramProfileById).toHaveBeenCalledWith('profile-1', mockTx)
  })

  it('should use tx for programProfile.update at the end', async () => {
    await updateMahadStudent('profile-1', {
      gradeLevel: 'GRADE_1',
      billingType: 'FULL_TIME',
    })

    expect(mockProgramProfileUpdate).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: expect.objectContaining({
        gradeLevel: 'GRADE_1',
        billingType: 'FULL_TIME',
      }),
    })
  })

  it('should throw ActionError when profile not found', async () => {
    mockGetProgramProfileById.mockResolvedValue(null)

    await expect(
      updateMahadStudent('nonexistent', { name: 'Test' })
    ).rejects.toThrow(ActionError)
  })

  it('should roll back all writes when programProfile.update fails', async () => {
    mockProgramProfileUpdate.mockRejectedValue(new Error('DB error'))

    await expect(
      updateMahadStudent('profile-1', { name: 'New Name' })
    ).rejects.toThrow('DB error')

    expect(mockPersonUpdate).toHaveBeenCalled()
    expect(mockProgramProfileUpdate).toHaveBeenCalled()
  })
})

describe('deleteMahadStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation(
      (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(mockTx)
    )
    mockEnrollmentUpdateMany.mockResolvedValue({ count: 1 })
    mockProgramProfileUpdate.mockResolvedValue({
      id: 'profile-1',
      status: 'WITHDRAWN',
    })
  })

  it('soft-deletes the profile and withdraws active enrollments', async () => {
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'MAHAD_PROGRAM',
    })

    const result = await deleteMahadStudent('profile-1')

    expect(mockEnrollmentUpdateMany).toHaveBeenCalledWith({
      where: {
        programProfileId: 'profile-1',
        status: { not: 'WITHDRAWN' },
      },
      data: expect.objectContaining({ status: 'WITHDRAWN' }),
    })
    expect(mockProgramProfileUpdate).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { status: 'WITHDRAWN' },
    })
    expect(result).toMatchObject({ id: 'profile-1', status: 'WITHDRAWN' })
  })

  it('throws PROFILE_NOT_FOUND when no profile exists for the id', async () => {
    mockGetProgramProfileById.mockResolvedValue(null)

    await expect(deleteMahadStudent('does-not-exist')).rejects.toMatchObject({
      message: 'Mahad student profile not found',
      code: 'PROFILE_NOT_FOUND',
      statusCode: 404,
    })
  })

  it('throws PROFILE_NOT_FOUND when the profile belongs to a different program', async () => {
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI_PROGRAM',
    })

    await expect(deleteMahadStudent('profile-1')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
      statusCode: 404,
    })
  })

  it('translates a concurrent delete (P2025) into PROFILE_NOT_FOUND', async () => {
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'MAHAD_PROGRAM',
    })
    const p2025 = new Prisma.PrismaClientKnownRequestError(
      'Record to update not found.',
      { code: 'P2025', clientVersion: 'test' }
    )
    mockProgramProfileUpdate.mockRejectedValueOnce(p2025)

    await expect(deleteMahadStudent('profile-1')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
      statusCode: 404,
    })
  })

  it('rethrows unexpected database errors', async () => {
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'MAHAD_PROGRAM',
    })
    const boom = new Error('db down')
    mockProgramProfileUpdate.mockRejectedValueOnce(boom)

    await expect(deleteMahadStudent('profile-1')).rejects.toBe(boom)
  })
})
