import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPersonCreate,
  mockPersonUpdate,
  mockProgramProfileCreate,
  mockEnrollmentCreate,
  mockTransaction,
  mockCheckDuplicate,
} = vi.hoisted(() => ({
  mockPersonCreate: vi.fn(),
  mockPersonUpdate: vi.fn(),
  mockProgramProfileCreate: vi.fn(),
  mockEnrollmentCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockCheckDuplicate: vi.fn(),
}))

const mockTx = {
  person: {
    create: (...args: unknown[]) => mockPersonCreate(...args),
    update: (...args: unknown[]) => mockPersonUpdate(...args),
  },
  programProfile: {
    create: (...args: unknown[]) => mockProgramProfileCreate(...args),
  },
  enrollment: {
    create: (...args: unknown[]) => mockEnrollmentCreate(...args),
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

vi.mock('@/lib/utils/contact-normalization', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/utils/contact-normalization')
  >('@/lib/utils/contact-normalization')
  return {
    normalizeEmail: actual.normalizeEmail,
    normalizePhone: actual.normalizePhone,
  }
})

vi.mock('@/lib/services/duplicate-detection-service', () => ({
  DuplicateDetectionService: {
    checkDuplicate: (...args: unknown[]) => mockCheckDuplicate(...args),
  },
}))

import { ActionError } from '@/lib/errors/action-error'

import { registerMahadStudent } from '../registration-service'

const noDuplicateResult = {
  isDuplicate: false,
  duplicateField: null,
  existingPerson: null,
  hasActiveProfile: false,
}

const baseInput = {
  name: 'Ahmed Mohamed',
  email: 'ahmed@example.com',
  phone: '612-555-1234',
  dateOfBirth: new Date('2005-06-15'),
}

describe('registerMahadStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckDuplicate.mockResolvedValue(noDuplicateResult)
    mockPersonCreate.mockResolvedValue({
      id: 'person-1',
      name: 'Ahmed Mohamed',
    })
    mockProgramProfileCreate.mockResolvedValue({
      id: 'profile-1',
      personId: 'person-1',
      program: 'MAHAD_PROGRAM',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
  })

  it('returns the new profileId', async () => {
    const result = await registerMahadStudent(baseInput)

    expect(result).toEqual({ profileId: 'profile-1' })
    expect(mockPersonCreate).toHaveBeenCalledWith({
      data: {
        name: 'Ahmed Mohamed',
        dateOfBirth: baseInput.dateOfBirth,
        email: 'ahmed@example.com',
        phone: '6125551234',
      },
    })
    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        personId: 'person-1',
        program: 'MAHAD_PROGRAM',
      }),
    })
  })

  it('uses DuplicateDetectionService.checkDuplicate within transaction', async () => {
    await registerMahadStudent(baseInput)

    expect(mockCheckDuplicate).toHaveBeenCalledWith(
      {
        email: 'ahmed@example.com',
        phone: '6125551234',
        program: 'MAHAD_PROGRAM',
      },
      mockTx
    )
  })

  it('reuses existing Person found by DuplicateDetectionService', async () => {
    const existingPerson = {
      id: 'existing-person',
      name: 'Ahmed',
      email: 'ahmed@example.com',
      phone: null,
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })

    await registerMahadStudent(baseInput)

    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-person' },
        data: { phone: '6125551234', dateOfBirth: baseInput.dateOfBirth },
      })
    )
    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ personId: 'existing-person' }),
    })
  })

  it('rejects duplicate MAHAD profile for existing Person', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson: {
        id: 'existing-person',
        name: 'Ahmed',
        email: 'ahmed@example.com',
        phone: null,
      },
      hasActiveProfile: true,
      activeProfile: {
        id: 'existing-profile',
        program: 'MAHAD_PROGRAM',
        enrollmentCount: 1,
        createdAt: new Date(),
      },
    })

    await expect(registerMahadStudent(baseInput)).rejects.toThrow(ActionError)
    await expect(registerMahadStudent(baseInput)).rejects.toThrow(
      'Student already registered for Mahad'
    )
    expect(mockProgramProfileCreate).not.toHaveBeenCalled()
  })

  it('updates email/phone on existing Person for returnee', async () => {
    const existingPerson = {
      id: 'returnee-person',
      name: 'Ahmed',
      email: null,
      phone: null,
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })

    await registerMahadStudent(baseInput)

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'returnee-person' },
        data: {
          email: 'ahmed@example.com',
          phone: '6125551234',
          dateOfBirth: baseInput.dateOfBirth,
        },
      })
    )
    expect(mockPersonCreate).not.toHaveBeenCalled()
  })

  it('updates email on Person found by phone', async () => {
    const existingPerson = {
      id: 'phone-only-person',
      name: 'Ahmed',
      email: null,
      phone: '6125551234',
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'phone',
      existingPerson,
      hasActiveProfile: false,
    })

    await registerMahadStudent(baseInput)

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'phone-only-person' },
        data: {
          email: 'ahmed@example.com',
          dateOfBirth: baseInput.dateOfBirth,
        },
      })
    )
    expect(mockPersonCreate).not.toHaveBeenCalled()
  })

  it('updates phone on Person found by email', async () => {
    const existingPerson = {
      id: 'email-only-person',
      name: 'Ahmed',
      email: 'ahmed@example.com',
      phone: null,
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })

    await registerMahadStudent(baseInput)

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'email-only-person' },
        data: {
          phone: '6125551234',
          dateOfBirth: baseInput.dateOfBirth,
        },
      })
    )
    expect(mockPersonCreate).not.toHaveBeenCalled()
  })

  it('does not overwrite an existing dateOfBirth on Person reuse', async () => {
    const storedDob = new Date('1980-01-01')
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson: {
        id: 'has-dob-person',
        name: 'Ahmed',
        email: 'ahmed@example.com',
        phone: '6125551234',
        dateOfBirth: storedDob,
      },
      hasActiveProfile: false,
    })

    await registerMahadStudent(baseInput)

    expect(mockPersonUpdate).not.toHaveBeenCalled()
  })

  it('allows cross-program Person reuse (Dugsi parent registering for Mahad)', async () => {
    const existingPerson = {
      id: 'dugsi-parent',
      name: 'Ahmed',
      email: 'ahmed@example.com',
      phone: null,
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })

    await registerMahadStudent(baseInput)

    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ personId: 'dugsi-parent' }),
    })
  })

  it('includes billing fields in single programProfile.create', async () => {
    const input = {
      ...baseInput,
      graduationStatus: 'NON_GRADUATE' as const,
      paymentFrequency: 'MONTHLY' as const,
    }

    await registerMahadStudent(input)

    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: null,
        paymentNotes: null,
      }),
    })
  })

  it('always creates an enrollment record', async () => {
    await registerMahadStudent(baseInput)

    expect(mockEnrollmentCreate).toHaveBeenCalledWith({
      data: {
        programProfileId: 'profile-1',
        batchId: null,
        status: 'REGISTERED',
        startDate: expect.any(Date),
      },
    })
  })

  it('creates enrollment with batchId when provided', async () => {
    await registerMahadStudent({ ...baseInput, batchId: 'batch-1' })

    expect(mockEnrollmentCreate).toHaveBeenCalledWith({
      data: {
        programProfileId: 'profile-1',
        batchId: 'batch-1',
        status: 'REGISTERED',
        startDate: expect.any(Date),
      },
    })
  })

  it('normalizes phone to digits only', async () => {
    await registerMahadStudent({ ...baseInput, phone: '(612) 555-1234' })

    expect(mockPersonCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '6125551234',
      }),
    })
  })

  it('handles email-only registration without phone', async () => {
    await registerMahadStudent({ ...baseInput, phone: undefined })

    expect(mockPersonCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'ahmed@example.com',
        phone: null,
      }),
    })
  })

  it('maps duplicateField "both" to email field in ActionError', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'both',
      existingPerson: {
        id: 'existing-person',
        name: 'Ahmed',
        email: 'ahmed@example.com',
        phone: '6125551234',
      },
      hasActiveProfile: true,
      activeProfile: {
        id: 'existing-profile',
        program: 'MAHAD_PROGRAM',
        enrollmentCount: 1,
        createdAt: new Date(),
      },
    })

    try {
      await registerMahadStudent(baseInput)
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ActionError)
      expect((error as ActionError).field).toBe('email')
    }
  })

  it('maps duplicateField "phone" to phone field in ActionError', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'phone',
      existingPerson: {
        id: 'existing-person',
        name: 'Ahmed',
        email: null,
        phone: '6125551234',
      },
      hasActiveProfile: true,
      activeProfile: {
        id: 'existing-profile',
        program: 'MAHAD_PROGRAM',
        enrollmentCount: 1,
        createdAt: new Date(),
      },
    })

    try {
      await registerMahadStudent(baseInput)
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ActionError)
      expect((error as ActionError).field).toBe('phone')
    }
  })

  it('handles registration with no email and no phone', async () => {
    await registerMahadStudent({
      ...baseInput,
      email: undefined,
      phone: undefined,
    })

    expect(mockPersonCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: null,
        phone: null,
      }),
    })
  })

  it('returns only the profileId', async () => {
    mockProgramProfileCreate.mockResolvedValue({
      id: 'profile-1',
      personId: 'person-1',
      program: 'MAHAD_PROGRAM',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    const result = await registerMahadStudent({
      ...baseInput,
      name: '  Ahmed   Mohamed Hassan  ',
    })

    expect(result).toEqual({ profileId: 'profile-1' })
  })
})
