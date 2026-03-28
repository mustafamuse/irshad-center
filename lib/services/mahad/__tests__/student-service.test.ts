import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPersonCreate,
  mockPersonUpdate,
  mockProgramProfileCreate,
  mockProgramProfileUpdate,
  mockEnrollmentCreate,
  mockContactPointFindFirst,
  mockContactPointUpdate,
  mockContactPointCreate,
  mockTransaction,
  mockGetProgramProfileById,
  mockCheckDuplicate,
} = vi.hoisted(() => ({
  mockPersonCreate: vi.fn(),
  mockPersonUpdate: vi.fn(),
  mockProgramProfileCreate: vi.fn(),
  mockProgramProfileUpdate: vi.fn(),
  mockEnrollmentCreate: vi.fn(),
  mockContactPointFindFirst: vi.fn(),
  mockContactPointUpdate: vi.fn(),
  mockContactPointCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetProgramProfileById: vi.fn(),
  mockCheckDuplicate: vi.fn(),
}))

const mockTx = {
  person: {
    create: (...args: unknown[]) => mockPersonCreate(...args),
    update: (...args: unknown[]) => mockPersonUpdate(...args),
  },
  programProfile: {
    create: (...args: unknown[]) => mockProgramProfileCreate(...args),
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
}))

vi.mock('@/lib/db/queries/siblings', () => ({
  getPersonSiblings: vi.fn(),
}))

vi.mock('@/lib/utils/contact-normalization', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/utils/contact-normalization')
  >('@/lib/utils/contact-normalization')
  return {
    normalizeEmail: (email: string | null | undefined) => {
      if (!email) return null
      return email.toLowerCase().trim()
    },
    normalizePhone: actual.normalizePhone,
  }
})

vi.mock('@/lib/services/duplicate-detection-service', () => ({
  DuplicateDetectionService: {
    checkDuplicate: (...args: unknown[]) => mockCheckDuplicate(...args),
  },
}))

import { ActionError } from '@/lib/errors/action-error'

import { createMahadStudent, updateMahadStudent } from '../student-service'

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

describe('createMahadStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckDuplicate.mockResolvedValue(noDuplicateResult)
    mockContactPointFindFirst.mockResolvedValue(null)
    mockPersonCreate.mockResolvedValue({
      id: 'person-1',
      name: 'Ahmed Mohamed',
    })
    mockProgramProfileCreate.mockResolvedValue({
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
            { type: 'PHONE', value: '6125551234' },
          ],
        },
      },
    })
    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        personId: 'person-1',
        program: 'MAHAD_PROGRAM',
      }),
    })
  })

  it('should use DuplicateDetectionService.checkDuplicate within transaction', async () => {
    await createMahadStudent(baseInput)

    expect(mockCheckDuplicate).toHaveBeenCalledWith(
      {
        email: 'ahmed@example.com',
        phone: '6125551234',
        program: 'MAHAD_PROGRAM',
      },
      mockTx
    )
  })

  it('should reuse existing Person found by DuplicateDetectionService', async () => {
    const existingPerson = {
      id: 'existing-person',
      name: 'Ahmed',
      contactPoints: [
        {
          id: 'cp-1',
          type: 'EMAIL',
          value: 'ahmed@example.com',
          isActive: true,
        },
      ],
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })

    await createMahadStudent(baseInput)

    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ personId: 'existing-person' }),
    })
  })

  it('should reject duplicate MAHAD profile for existing Person', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson: {
        id: 'existing-person',
        name: 'Ahmed',
        contactPoints: [],
      },
      hasActiveProfile: true,
      activeProfile: {
        id: 'existing-profile',
        program: 'MAHAD_PROGRAM',
        enrollmentCount: 1,
        createdAt: new Date(),
      },
    })

    await expect(createMahadStudent(baseInput)).rejects.toThrow(ActionError)
    await expect(createMahadStudent(baseInput)).rejects.toThrow(
      'Student already registered for Mahad'
    )
    expect(mockProgramProfileCreate).not.toHaveBeenCalled()
  })

  it('should reactivate deactivated email contact for returnee', async () => {
    const existingPerson = {
      id: 'returnee-person',
      name: 'Ahmed',
      contactPoints: [
        {
          id: 'cp-email',
          type: 'EMAIL',
          value: 'ahmed@example.com',
          isActive: false,
          deactivatedAt: new Date(),
        },
      ],
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })

    await createMahadStudent(baseInput)

    expect(mockContactPointUpdate).toHaveBeenCalledWith({
      where: { id: 'cp-email' },
      data: { isActive: true, deactivatedAt: null },
    })
    expect(mockPersonCreate).not.toHaveBeenCalled()
  })

  it('should reactivate deactivated phone contact for returnee', async () => {
    const existingPerson = {
      id: 'returnee-person',
      name: 'Ahmed',
      contactPoints: [
        {
          id: 'cp-email',
          type: 'EMAIL',
          value: 'ahmed@example.com',
          isActive: true,
        },
        {
          id: 'cp-phone',
          type: 'PHONE',
          value: '6125551234',
          isActive: false,
          deactivatedAt: new Date(),
        },
      ],
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'phone',
      existingPerson,
      hasActiveProfile: false,
    })

    await createMahadStudent(baseInput)

    expect(mockContactPointUpdate).toHaveBeenCalledWith({
      where: { id: 'cp-phone' },
      data: { isActive: true, deactivatedAt: null },
    })
    expect(mockPersonCreate).not.toHaveBeenCalled()
  })

  // Person matched by email; WHATSAPP contact has same phone and needs reactivation
  it('should reactivate deactivated WHATSAPP contact matching submitted phone', async () => {
    const existingPerson = {
      id: 'returnee-person',
      name: 'Ahmed',
      contactPoints: [
        {
          id: 'cp-email',
          type: 'EMAIL',
          value: 'ahmed@example.com',
          isActive: true,
        },
        {
          id: 'cp-whatsapp',
          type: 'WHATSAPP',
          value: '6125551234',
          isActive: false,
          deactivatedAt: new Date(),
        },
      ],
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })

    await createMahadStudent(baseInput)

    expect(mockContactPointUpdate).toHaveBeenCalledWith({
      where: { id: 'cp-whatsapp' },
      data: { isActive: true, deactivatedAt: null },
    })
    expect(mockContactPointCreate).not.toHaveBeenCalled()
  })

  it('should throw CONTACT_CLAIMED when reactivating email already owned by another person', async () => {
    const existingPerson = {
      id: 'returnee-person',
      name: 'Ahmed',
      contactPoints: [
        {
          id: 'cp-email',
          type: 'EMAIL',
          value: 'ahmed@example.com',
          isActive: false,
          deactivatedAt: new Date(),
        },
      ],
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })
    mockContactPointFindFirst.mockResolvedValue({
      id: 'other-cp',
      type: 'EMAIL',
      value: 'ahmed@example.com',
      isActive: true,
      personId: 'other-person',
    })

    await expect(createMahadStudent(baseInput)).rejects.toThrow(ActionError)
    await expect(createMahadStudent(baseInput)).rejects.toThrow(
      'This email address is already registered to another person'
    )
    expect(mockContactPointUpdate).not.toHaveBeenCalled()
  })

  it('should throw CONTACT_CLAIMED when reactivating phone already owned by another person', async () => {
    const existingPerson = {
      id: 'returnee-person',
      name: 'Ahmed',
      contactPoints: [
        {
          id: 'cp-email',
          type: 'EMAIL',
          value: 'ahmed@example.com',
          isActive: true,
        },
        {
          id: 'cp-phone',
          type: 'PHONE',
          value: '6125551234',
          isActive: false,
          deactivatedAt: new Date(),
        },
      ],
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'phone',
      existingPerson,
      hasActiveProfile: false,
    })
    mockContactPointFindFirst.mockResolvedValue({
      id: 'other-cp',
      type: 'PHONE',
      value: '6125551234',
      isActive: true,
      personId: 'other-person',
    })

    await expect(createMahadStudent(baseInput)).rejects.toThrow(ActionError)
    await expect(createMahadStudent(baseInput)).rejects.toThrow(
      'This phone number is already registered to another person'
    )
    expect(mockContactPointUpdate).not.toHaveBeenCalled()
  })

  it('should create email contact when person found by phone only', async () => {
    const existingPerson = {
      id: 'phone-only-person',
      name: 'Ahmed',
      contactPoints: [
        {
          id: 'cp-phone',
          type: 'PHONE',
          value: '6125551234',
          isActive: true,
        },
      ],
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'phone',
      existingPerson,
      hasActiveProfile: false,
    })

    await createMahadStudent(baseInput)

    expect(mockContactPointCreate).toHaveBeenCalledWith({
      data: {
        personId: 'phone-only-person',
        type: 'EMAIL',
        value: 'ahmed@example.com',
        isPrimary: true,
      },
    })
    expect(mockPersonCreate).not.toHaveBeenCalled()
  })

  it('should create phone contact when person found by email only', async () => {
    const existingPerson = {
      id: 'email-only-person',
      name: 'Ahmed',
      contactPoints: [
        {
          id: 'cp-email',
          type: 'EMAIL',
          value: 'ahmed@example.com',
          isActive: true,
        },
      ],
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })

    await createMahadStudent(baseInput)

    expect(mockContactPointCreate).toHaveBeenCalledWith({
      data: {
        personId: 'email-only-person',
        type: 'PHONE',
        value: '6125551234',
      },
    })
    expect(mockPersonCreate).not.toHaveBeenCalled()
  })

  it('should allow cross-program Person reuse (Dugsi parent registering for Mahad)', async () => {
    const existingPerson = {
      id: 'dugsi-parent',
      name: 'Ahmed',
      contactPoints: [
        {
          id: 'cp-1',
          type: 'EMAIL',
          value: 'ahmed@example.com',
          isActive: true,
        },
      ],
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })

    await createMahadStudent(baseInput)

    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ personId: 'dugsi-parent' }),
    })
  })

  it('should include billing fields in single programProfile.create', async () => {
    const input = {
      ...baseInput,
      graduationStatus: 'NON_GRADUATE' as const,
      paymentFrequency: 'MONTHLY' as const,
    }

    await createMahadStudent(input)

    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: null,
        paymentNotes: null,
      }),
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

  it('should normalize phone to digits only', async () => {
    await createMahadStudent({ ...baseInput, phone: '(612) 555-1234' })

    expect(mockPersonCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactPoints: {
          create: expect.arrayContaining([
            { type: 'PHONE', value: '6125551234' },
          ]),
        },
      }),
    })
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

  it('should map duplicateField "both" to email field in ActionError', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'both',
      existingPerson: {
        id: 'existing-person',
        name: 'Ahmed',
        contactPoints: [],
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
      await createMahadStudent(baseInput)
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ActionError)
      expect((error as ActionError).field).toBe('email')
    }
  })

  it('should map duplicateField "phone" to phone field in ActionError', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'phone',
      existingPerson: {
        id: 'existing-person',
        name: 'Ahmed',
        contactPoints: [],
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
      await createMahadStudent(baseInput)
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ActionError)
      expect((error as ActionError).field).toBe('phone')
    }
  })

  it('should handle registration with no email and no phone', async () => {
    await createMahadStudent({
      ...baseInput,
      email: undefined,
      phone: undefined,
    })

    expect(mockPersonCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactPoints: {
          create: [],
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
