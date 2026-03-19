import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPersonFindFirst,
  mockPersonCreate,
  mockPersonUpdate,
  mockProgramProfileFindFirst,
  mockProgramProfileUpdate,
  mockEnrollmentCreate,
  mockCreateProgramProfile,
  mockContactPointFindFirst,
  mockContactPointUpdate,
  mockContactPointCreate,
  mockTransaction,
  mockGetProgramProfileById,
} = vi.hoisted(() => ({
  mockPersonFindFirst: vi.fn(),
  mockPersonCreate: vi.fn(),
  mockPersonUpdate: vi.fn(),
  mockProgramProfileFindFirst: vi.fn(),
  mockProgramProfileUpdate: vi.fn(),
  mockEnrollmentCreate: vi.fn(),
  mockCreateProgramProfile: vi.fn(),
  mockContactPointFindFirst: vi.fn(),
  mockContactPointUpdate: vi.fn(),
  mockContactPointCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetProgramProfileById: vi.fn(),
}))

const mockTx = {
  person: {
    findFirst: (...args: unknown[]) => mockPersonFindFirst(...args),
    create: (...args: unknown[]) => mockPersonCreate(...args),
    update: (...args: unknown[]) => mockPersonUpdate(...args),
  },
  programProfile: {
    findFirst: (...args: unknown[]) => mockProgramProfileFindFirst(...args),
    update: (...args: unknown[]) => mockProgramProfileUpdate(...args),
  },
  enrollment: {
    create: (...args: unknown[]) => mockEnrollmentCreate(...args),
  },
  contactPoint: {
    findFirst: (...args: unknown[]) => mockContactPointFindFirst(...args),
    update: (...args: unknown[]) => mockContactPointUpdate(...args),
    create: (...args: unknown[]) => mockContactPointCreate(...args),
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
  createProgramProfile: (...args: unknown[]) =>
    mockCreateProgramProfile(...args),
}))

vi.mock('@/lib/db/queries/siblings', () => ({
  getPersonSiblings: vi.fn(),
}))

import { ActionError } from '@/lib/errors/action-error'

import { createMahadStudent, updateMahadStudent } from '../student-service'

const baseInput = {
  name: 'Ahmed Mohamed',
  email: 'ahmed@example.com',
  phone: '612-555-1234',
  dateOfBirth: new Date('2005-06-15'),
}

describe('createMahadStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPersonFindFirst.mockResolvedValue(null)
    mockProgramProfileFindFirst.mockResolvedValue(null)
    mockPersonCreate.mockResolvedValue({
      id: 'person-1',
      name: 'Ahmed Mohamed',
    })
    mockCreateProgramProfile.mockResolvedValue({
      id: 'profile-1',
      personId: 'person-1',
      program: 'MAHAD_PROGRAM',
    })
  })

  it('should create Person, ContactPoints, and ProgramProfile', async () => {
    const result = await createMahadStudent(baseInput)

    expect(result).toEqual({
      id: 'profile-1',
      personId: 'person-1',
      program: 'MAHAD_PROGRAM',
    })
    expect(mockPersonCreate).toHaveBeenCalledWith({
      data: {
        name: 'Ahmed Mohamed',
        dateOfBirth: baseInput.dateOfBirth,
        contactPoints: {
          create: [
            { type: 'EMAIL', value: 'ahmed@example.com', isPrimary: true },
            { type: 'PHONE', value: '612-555-1234' },
          ],
        },
      },
    })
    expect(mockCreateProgramProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: 'person-1',
        program: 'MAHAD_PROGRAM',
      }),
      mockTx
    )
  })

  it('should reuse existing Person found by email', async () => {
    const existingPerson = { id: 'existing-person', name: 'Ahmed' }
    mockPersonFindFirst.mockResolvedValue(existingPerson)

    await createMahadStudent(baseInput)

    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockCreateProgramProfile).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'existing-person' }),
      mockTx
    )
  })

  it('should reject duplicate MAHAD profile for existing Person', async () => {
    const existingPerson = { id: 'existing-person', name: 'Ahmed' }
    mockPersonFindFirst.mockResolvedValue(existingPerson)
    mockProgramProfileFindFirst.mockResolvedValue({
      id: 'existing-profile',
      program: 'MAHAD_PROGRAM',
    })

    await expect(createMahadStudent(baseInput)).rejects.toThrow(ActionError)
    await expect(createMahadStudent(baseInput)).rejects.toThrow(
      'Student already registered for Mahad'
    )
    expect(mockCreateProgramProfile).not.toHaveBeenCalled()
  })

  it('should set graduationStatus and paymentFrequency', async () => {
    const input = {
      ...baseInput,
      graduationStatus: 'NON_GRADUATE' as const,
      paymentFrequency: 'MONTHLY' as const,
    }

    await createMahadStudent(input)

    expect(mockProgramProfileUpdate).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: {
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: null,
        paymentNotes: null,
      },
    })
  })

  it('should always create enrollment record', async () => {
    await createMahadStudent(baseInput)

    expect(mockEnrollmentCreate).toHaveBeenCalledWith({
      data: {
        programProfileId: 'profile-1',
        batchId: null,
        status: 'REGISTERED',
        startDate: expect.any(Date),
      },
    })
  })

  it('should create enrollment with batchId when provided', async () => {
    await createMahadStudent({ ...baseInput, batchId: 'batch-1' })

    expect(mockEnrollmentCreate).toHaveBeenCalledWith({
      data: {
        programProfileId: 'profile-1',
        batchId: 'batch-1',
        status: 'REGISTERED',
        startDate: expect.any(Date),
      },
    })
  })

  it('should skip billing update when no billing fields provided', async () => {
    await createMahadStudent(baseInput)

    expect(mockProgramProfileUpdate).not.toHaveBeenCalled()
  })

  it('should handle email-only registration without phone', async () => {
    await createMahadStudent({ ...baseInput, phone: undefined })

    expect(mockPersonCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactPoints: {
          create: [
            { type: 'EMAIL', value: 'ahmed@example.com', isPrimary: true },
          ],
        },
      }),
    })
  })
})

describe('updateMahadStudent', () => {
  const mockProfile = {
    id: 'profile-1',
    personId: 'person-1',
    program: 'MAHAD_PROGRAM',
    person: { contactPoints: [] },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProgramProfileById.mockResolvedValue(mockProfile)
    mockPersonUpdate.mockResolvedValue({ id: 'person-1' })
    mockProgramProfileUpdate.mockResolvedValue({ id: 'profile-1' })
    mockContactPointFindFirst.mockResolvedValue(null)
    mockContactPointCreate.mockResolvedValue({ id: 'cp-1' })
    mockTransaction.mockImplementation(
      (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(mockTx)
    )
  })

  it('should wrap updates in $transaction when no client is passed', async () => {
    await updateMahadStudent('profile-1', { name: 'New Name' })

    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should use tx client for person.update, not module-level prisma', async () => {
    await updateMahadStudent('profile-1', { name: 'New Name' })

    expect(mockPersonUpdate).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { name: 'New Name', dateOfBirth: undefined },
    })
  })

  it('should use tx client for contactPoint operations', async () => {
    mockContactPointFindFirst.mockResolvedValue({
      id: 'cp-email',
      type: 'EMAIL',
      value: 'old@test.com',
    })

    await updateMahadStudent('profile-1', { email: 'new@test.com' })

    expect(mockContactPointFindFirst).toHaveBeenCalledWith({
      where: { personId: 'person-1', type: 'EMAIL' },
    })
    expect(mockContactPointUpdate).toHaveBeenCalledWith({
      where: { id: 'cp-email' },
      data: { value: 'new@test.com' },
    })
  })

  it('should pass tx to getProgramProfileById', async () => {
    await updateMahadStudent('profile-1', { name: 'Test' })

    expect(mockGetProgramProfileById).toHaveBeenCalledWith('profile-1', mockTx)
  })

  it('should use tx for programProfile.update at the end', async () => {
    await updateMahadStudent('profile-1', {
      gradeLevel: 'GRADE_1',
      billingType: 'FULL_PAYING',
    })

    expect(mockProgramProfileUpdate).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: expect.objectContaining({
        gradeLevel: 'GRADE_1',
        billingType: 'FULL_PAYING',
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
