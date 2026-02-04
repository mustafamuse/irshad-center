import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPersonFindFirst,
  mockPersonCreate,
  mockProgramProfileFindFirst,
  mockProgramProfileUpdate,
  mockEnrollmentCreate,
  mockCreateProgramProfile,
} = vi.hoisted(() => ({
  mockPersonFindFirst: vi.fn(),
  mockPersonCreate: vi.fn(),
  mockProgramProfileFindFirst: vi.fn(),
  mockProgramProfileUpdate: vi.fn(),
  mockEnrollmentCreate: vi.fn(),
  mockCreateProgramProfile: vi.fn(),
}))

const mockTx = {
  person: {
    findFirst: (...args: unknown[]) => mockPersonFindFirst(...args),
    create: (...args: unknown[]) => mockPersonCreate(...args),
  },
  programProfile: {
    findFirst: (...args: unknown[]) => mockProgramProfileFindFirst(...args),
    update: (...args: unknown[]) => mockProgramProfileUpdate(...args),
  },
  enrollment: {
    create: (...args: unknown[]) => mockEnrollmentCreate(...args),
  },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
  },
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfileById: vi.fn(),
  createProgramProfile: (...args: unknown[]) =>
    mockCreateProgramProfile(...args),
}))

vi.mock('@/lib/db/queries/siblings', () => ({
  getPersonSiblings: vi.fn(),
}))

import { ActionError } from '@/lib/errors/action-error'

import { createMahadStudent } from '../student-service'

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

  it('should create enrollment when batchId is provided', async () => {
    await createMahadStudent({ ...baseInput, batchId: 'batch-1' })

    expect(mockEnrollmentCreate).toHaveBeenCalledWith({
      data: {
        programProfileId: 'profile-1',
        batchId: 'batch-1',
        status: 'ENROLLED',
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
