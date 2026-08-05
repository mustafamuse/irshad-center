import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPersonCreate,
  mockPersonUpdate,
  mockPersonFindMany,
  mockFindPersonByEmailExcluding,
  mockFindPersonByPhoneExcluding,
  mockProgramProfileCreate,
  mockProgramProfileFindUnique,
  mockProgramProfileFindForReuse,
  mockProgramProfileUpdate,
  mockEnrollmentCreate,
  mockTransaction,
  mockCheckDuplicate,
} = vi.hoisted(() => ({
  mockPersonCreate: vi.fn(),
  mockPersonUpdate: vi.fn(),
  mockPersonFindMany: vi.fn(),
  mockFindPersonByEmailExcluding: vi.fn(),
  mockFindPersonByPhoneExcluding: vi.fn(),
  mockProgramProfileCreate: vi.fn(),
  mockProgramProfileFindUnique: vi.fn(),
  mockProgramProfileFindForReuse: vi.fn(),
  mockProgramProfileUpdate: vi.fn(),
  mockEnrollmentCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockCheckDuplicate: vi.fn(),
}))

const mockTx = { __marker: 'tx' }

mockTransaction.mockImplementation(
  (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(mockTx)
)

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/db/queries/person', () => ({
  createPerson: (...args: unknown[]) => mockPersonCreate(...args),
  updatePersonFields: (...args: unknown[]) => mockPersonUpdate(...args),
  findPersonByEmailExcluding: (...args: unknown[]) =>
    mockFindPersonByEmailExcluding(...args),
  findPersonByPhoneExcluding: (...args: unknown[]) =>
    mockFindPersonByPhoneExcluding(...args),
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  createProgramProfileRecord: (...args: unknown[]) =>
    mockProgramProfileCreate(...args),
  findProgramProfileForMahadInvite: (...args: unknown[]) =>
    mockProgramProfileFindUnique(...args),
  findProgramProfileForReuse: (...args: unknown[]) =>
    mockProgramProfileFindForReuse(...args),
  updateProgramProfileFields: (...args: unknown[]) =>
    mockProgramProfileUpdate(...args),
  findContactlessMahadPersonsByName: (...args: unknown[]) =>
    mockPersonFindMany(...args),
}))

vi.mock('@/lib/db/queries/enrollment', () => ({
  createMahadRegistrationEnrollment: (...args: unknown[]) =>
    mockEnrollmentCreate(...args),
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
    mockProgramProfileFindForReuse.mockResolvedValue(null)
    mockPersonFindMany.mockResolvedValue([])
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
    expect(mockPersonCreate).toHaveBeenCalledWith(
      {
        name: 'Ahmed Mohamed',
        dateOfBirth: baseInput.dateOfBirth,
        email: 'ahmed@example.com',
        phone: '6125551234',
      },
      mockTx
    )
    expect(mockProgramProfileCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: 'person-1',
        program: 'MAHAD_PROGRAM',
      }),
      mockTx
    )
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
      'existing-person',
      { phone: '6125551234', dateOfBirth: baseInput.dateOfBirth },
      mockTx
    )
    expect(mockProgramProfileCreate).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'existing-person' }),
      mockTx
    )
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
      'returnee-person',
      {
        email: 'ahmed@example.com',
        phone: '6125551234',
        dateOfBirth: baseInput.dateOfBirth,
      },
      mockTx
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
      'phone-only-person',
      {
        email: 'ahmed@example.com',
        dateOfBirth: baseInput.dateOfBirth,
      },
      mockTx
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
      'email-only-person',
      {
        phone: '6125551234',
        dateOfBirth: baseInput.dateOfBirth,
      },
      mockTx
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
    expect(mockProgramProfileCreate).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'dugsi-parent' }),
      mockTx
    )
  })

  it('reuses and re-activates a withdrawn returnee profile instead of hitting P2002', async () => {
    const existingPerson = {
      id: 'returnee-person',
      name: 'Ahmed Mohamed',
      email: 'ahmed@example.com',
      phone: '6125551234',
      dateOfBirth: new Date('2000-01-15'),
    }
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson,
      hasActiveProfile: false,
    })
    mockProgramProfileFindForReuse.mockResolvedValue({
      id: 'profile-withdrawn',
      status: 'WITHDRAWN',
      gradeLevel: null,
      schoolName: null,
      graduationStatus: null,
      paymentFrequency: null,
      billingType: null,
      paymentNotes: null,
      person: {
        id: 'returnee-person',
        email: 'ahmed@example.com',
        phone: '6125551234',
        dateOfBirth: new Date('2000-01-15'),
      },
      enrollments: [],
    })
    mockProgramProfileUpdate.mockResolvedValue({ id: 'profile-withdrawn' })

    const result = await registerMahadStudent(baseInput)

    expect(result).toEqual({ profileId: 'profile-withdrawn' })
    expect(mockProgramProfileCreate).not.toHaveBeenCalled()
    expect(mockProgramProfileUpdate).toHaveBeenCalledWith(
      'profile-withdrawn',
      expect.objectContaining({ status: 'REGISTERED' }),
      mockTx
    )
    expect(mockEnrollmentCreate).toHaveBeenCalledWith(
      'profile-withdrawn',
      undefined,
      mockTx
    )
  })

  it('preserves a non-withdrawn status when reusing an existing profile', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson: {
        id: 'returnee-person',
        name: 'Ahmed Mohamed',
        email: 'ahmed@example.com',
        phone: '6125551234',
        dateOfBirth: new Date('2000-01-15'),
      },
      hasActiveProfile: false,
    })
    mockProgramProfileFindForReuse.mockResolvedValue({
      id: 'profile-onleave',
      status: 'ON_LEAVE',
      gradeLevel: null,
      schoolName: null,
      graduationStatus: null,
      paymentFrequency: null,
      billingType: null,
      paymentNotes: null,
      person: {
        id: 'returnee-person',
        email: 'ahmed@example.com',
        phone: '6125551234',
        dateOfBirth: new Date('2000-01-15'),
      },
      enrollments: [{ id: 'enrollment-1' }],
    })

    const result = await registerMahadStudent(baseInput)

    expect(result).toEqual({ profileId: 'profile-onleave' })
    expect(mockProgramProfileCreate).not.toHaveBeenCalled()
    expect(mockProgramProfileUpdate).not.toHaveBeenCalled()
    expect(mockEnrollmentCreate).not.toHaveBeenCalled()
  })

  it('does not create an enrollment for a suspended profile with no open enrollment', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson: {
        id: 'suspended-person',
        name: 'Ahmed Mohamed',
        email: 'ahmed@example.com',
        phone: '6125551234',
        dateOfBirth: new Date('2000-01-15'),
      },
      hasActiveProfile: false,
    })
    mockProgramProfileFindForReuse.mockResolvedValue({
      id: 'profile-suspended',
      status: 'SUSPENDED',
      gradeLevel: null,
      schoolName: null,
      graduationStatus: null,
      paymentFrequency: null,
      billingType: null,
      paymentNotes: null,
      person: {
        id: 'suspended-person',
        email: 'ahmed@example.com',
        phone: '6125551234',
        dateOfBirth: new Date('2000-01-15'),
      },
      enrollments: [],
    })

    const result = await registerMahadStudent(baseInput)

    expect(result).toEqual({ profileId: 'profile-suspended' })
    expect(mockProgramProfileUpdate).not.toHaveBeenCalled()
    expect(mockEnrollmentCreate).not.toHaveBeenCalled()
  })

  it('includes billing fields in single programProfile.create', async () => {
    const input = {
      ...baseInput,
      graduationStatus: 'NON_GRADUATE' as const,
      paymentFrequency: 'MONTHLY' as const,
    }

    await registerMahadStudent(input)

    expect(mockProgramProfileCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: null,
        paymentNotes: null,
      }),
      mockTx
    )
  })

  it('always creates an enrollment record', async () => {
    await registerMahadStudent(baseInput)

    expect(mockEnrollmentCreate).toHaveBeenCalledWith(
      'profile-1',
      undefined,
      mockTx
    )
  })

  it('creates enrollment with batchId when provided', async () => {
    await registerMahadStudent({ ...baseInput, batchId: 'batch-1' })

    expect(mockEnrollmentCreate).toHaveBeenCalledWith(
      'profile-1',
      'batch-1',
      mockTx
    )
  })

  it('normalizes phone to digits only', async () => {
    await registerMahadStudent({ ...baseInput, phone: '(612) 555-1234' })

    expect(mockPersonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '6125551234',
      }),
      mockTx
    )
  })

  it('handles email-only registration without phone', async () => {
    await registerMahadStudent({ ...baseInput, phone: undefined })

    expect(mockPersonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ahmed@example.com',
        phone: null,
      }),
      mockTx
    )
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

    expect(mockPersonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        phone: null,
      }),
      mockTx
    )
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

describe('invite enrichment path', () => {
  const inviteProfile = {
    id: 'profile-recovery-1',
    program: 'MAHAD_PROGRAM',
    status: 'REGISTERED',
    gradeLevel: null,
    schoolName: null,
    graduationStatus: null,
    paymentFrequency: null,
    billingType: null,
    paymentNotes:
      'Created from attendance roster during 2026-08 billing recovery; billing pending checkout',
    person: {
      id: 'person-recovery-1',
      name: 'Habib Idris',
      email: null,
      phone: null,
      dateOfBirth: null,
    },
    enrollments: [{ id: 'enr-1', endDate: null }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckDuplicate.mockResolvedValue(noDuplicateResult)
    mockPersonFindMany.mockResolvedValue([])
    mockFindPersonByEmailExcluding.mockResolvedValue(null)
    mockFindPersonByPhoneExcluding.mockResolvedValue(null)
    mockProgramProfileFindUnique.mockResolvedValue(inviteProfile)
    mockPersonUpdate.mockResolvedValue({})
    mockProgramProfileUpdate.mockResolvedValue({ id: inviteProfile.id })
  })

  it('enriches the invited profile and returns its id', async () => {
    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })
    expect(result.profileId).toBe('profile-recovery-1')
    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockProgramProfileCreate).not.toHaveBeenCalled()
  })

  it('fills person nulls without overwriting existing values', async () => {
    mockProgramProfileFindUnique.mockResolvedValue({
      ...inviteProfile,
      person: { ...inviteProfile.person, email: 'kept@example.com' },
    })
    await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })
    const updateData = mockPersonUpdate.mock.calls[0][1] as Record<
      string,
      unknown
    >
    expect(updateData.email).toBeUndefined()
    expect(updateData.phone).toBeDefined()
  })

  it('does not create a second enrollment when one is active', async () => {
    await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })
    expect(mockEnrollmentCreate).not.toHaveBeenCalled()
  })

  it('creates an enrollment when the profile has none active', async () => {
    mockProgramProfileFindUnique.mockResolvedValue({
      ...inviteProfile,
      enrollments: [],
    })
    await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })
    expect(mockEnrollmentCreate).toHaveBeenCalledTimes(1)
  })

  it('falls through to normal create when the profile does not exist', async () => {
    mockProgramProfileFindUnique.mockResolvedValue(null)
    mockPersonCreate.mockResolvedValue({ id: 'person-new' })
    mockProgramProfileCreate.mockResolvedValue({ id: 'profile-new' })
    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-gone',
    })
    expect(result.profileId).toBe('profile-new')
  })

  it('falls through when the invited profile is not Mahad', async () => {
    mockProgramProfileFindUnique.mockResolvedValue({
      ...inviteProfile,
      program: 'DUGSI_PROGRAM',
    })
    mockPersonCreate.mockResolvedValue({ id: 'person-new' })
    mockProgramProfileCreate.mockResolvedValue({ id: 'profile-new' })
    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })
    expect(result.profileId).toBe('profile-new')
  })

  it('still 409s on duplicate contact even with an invite', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson: {
        id: 'p-x',
        email: 'x@x.com',
        phone: null,
        dateOfBirth: null,
      },
      hasActiveProfile: true,
    })
    await expect(
      registerMahadStudent({
        ...baseInput,
        inviteProfileId: 'profile-recovery-1',
      })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('skips writing a conflicting email owned by a different person without an active profile', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson: {
        id: 'dugsi-guardian',
        email: 'ahmed@example.com',
        phone: null,
        dateOfBirth: null,
      },
      hasActiveProfile: false,
    })
    mockFindPersonByEmailExcluding.mockResolvedValue({ id: 'dugsi-guardian' })

    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })

    expect(result.profileId).toBe('profile-recovery-1')
    expect(mockPersonUpdate).toHaveBeenCalledWith(
      'person-recovery-1',
      {
        phone: '6125551234',
        dateOfBirth: baseInput.dateOfBirth,
      },
      mockTx
    )
  })

  it('skips writing both email and phone when duplicateField is "both" on a different person', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'both',
      existingPerson: {
        id: 'dugsi-guardian',
        email: 'ahmed@example.com',
        phone: '6125551234',
        dateOfBirth: null,
      },
      hasActiveProfile: false,
    })
    mockFindPersonByEmailExcluding.mockResolvedValue({ id: 'dugsi-guardian' })
    mockFindPersonByPhoneExcluding.mockResolvedValue({ id: 'dugsi-guardian' })

    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })

    expect(result.profileId).toBe('profile-recovery-1')
    expect(mockPersonUpdate).toHaveBeenCalledWith(
      'person-recovery-1',
      {
        dateOfBirth: baseInput.dateOfBirth,
      },
      mockTx
    )
  })

  it('skips both email and phone when they are owned by two DIFFERENT third-party persons (checkDuplicate only reports one)', async () => {
    // checkDuplicate's findFirst over OR(email, phone) surfaces only the
    // email conflict here, even though the phone also belongs to a
    // different, unrelated third party.
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson: {
        id: 'third-party-a',
        email: 'ahmed@example.com',
        phone: null,
        dateOfBirth: null,
      },
      hasActiveProfile: false,
    })
    mockFindPersonByEmailExcluding.mockResolvedValue({ id: 'third-party-a' })
    mockFindPersonByPhoneExcluding.mockResolvedValue({ id: 'third-party-b' })

    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })

    expect(result.profileId).toBe('profile-recovery-1')
    expect(mockPersonUpdate).toHaveBeenCalledWith(
      'person-recovery-1',
      {
        dateOfBirth: baseInput.dateOfBirth,
      },
      mockTx
    )
  })

  it('writes both email and phone when neither has a third-party owner', async () => {
    mockCheckDuplicate.mockResolvedValue(noDuplicateResult)
    mockFindPersonByEmailExcluding.mockResolvedValue(null)
    mockFindPersonByPhoneExcluding.mockResolvedValue(null)

    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })

    expect(result.profileId).toBe('profile-recovery-1')
    expect(mockPersonUpdate).toHaveBeenCalledWith(
      'person-recovery-1',
      {
        email: 'ahmed@example.com',
        phone: '6125551234',
        dateOfBirth: baseInput.dateOfBirth,
      },
      mockTx
    )
  })

  it('fills fields normally when the duplicate person IS the invited person', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson: {
        id: 'person-recovery-1',
        email: null,
        phone: null,
        dateOfBirth: null,
      },
      hasActiveProfile: false,
    })

    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })

    expect(result.profileId).toBe('profile-recovery-1')
    expect(mockPersonUpdate).toHaveBeenCalledWith(
      'person-recovery-1',
      {
        email: 'ahmed@example.com',
        phone: '6125551234',
        dateOfBirth: baseInput.dateOfBirth,
      },
      mockTx
    )
  })

  it('appends the submitted paymentNotes after the recovery marker', async () => {
    await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
      paymentNotes: 'prefers cash',
    })
    const updateData = mockProgramProfileUpdate.mock.calls[0][1] as Record<
      string,
      unknown
    >
    expect(updateData.paymentNotes).toContain('billing pending checkout')
    expect(updateData.paymentNotes).toContain('prefers cash')
  })
})

describe('name fallback for contact-less recovery profiles', () => {
  const recoveryPersonMatch = {
    id: 'person-recovery-2',
    email: null,
    phone: null,
    dateOfBirth: null,
    programProfiles: [
      {
        id: 'profile-recovery-2',
        program: 'MAHAD_PROGRAM',
        status: 'REGISTERED',
        gradeLevel: null,
        schoolName: null,
        graduationStatus: null,
        paymentFrequency: null,
        billingType: null,
        paymentNotes: null,
        enrollments: [{ id: 'enr-2', endDate: null }],
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckDuplicate.mockResolvedValue(noDuplicateResult)
    mockPersonUpdate.mockResolvedValue({})
    mockProgramProfileUpdate.mockResolvedValue({})
  })

  it('merges into the single contact-less name match', async () => {
    mockPersonFindMany.mockResolvedValue([recoveryPersonMatch])
    const result = await registerMahadStudent(baseInput)
    expect(result.profileId).toBe('profile-recovery-2')
    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockProgramProfileCreate).not.toHaveBeenCalled()
  })

  it('queries contact-less persons by the submitted name and MAHAD_PROGRAM', async () => {
    mockPersonFindMany.mockResolvedValue([])
    mockPersonCreate.mockResolvedValue({ id: 'p-new' })
    mockProgramProfileCreate.mockResolvedValue({ id: 'pp-new' })
    await registerMahadStudent(baseInput)
    expect(mockPersonFindMany).toHaveBeenCalledWith(
      baseInput.name,
      'MAHAD_PROGRAM',
      mockTx
    )
  })

  it('creates fresh when zero matches', async () => {
    mockPersonFindMany.mockResolvedValue([])
    mockPersonCreate.mockResolvedValue({ id: 'p-new' })
    mockProgramProfileCreate.mockResolvedValue({ id: 'pp-new' })
    const result = await registerMahadStudent(baseInput)
    expect(result.profileId).toBe('pp-new')
    expect(mockPersonCreate).toHaveBeenCalledTimes(1)
  })

  it('creates fresh when two candidates match', async () => {
    mockPersonFindMany.mockResolvedValue([
      recoveryPersonMatch,
      { ...recoveryPersonMatch, id: 'person-recovery-3' },
    ])
    mockPersonCreate.mockResolvedValue({ id: 'p-new' })
    mockProgramProfileCreate.mockResolvedValue({ id: 'pp-new' })
    const result = await registerMahadStudent(baseInput)
    expect(result.profileId).toBe('pp-new')
  })

  it('does not run the fallback when checkDuplicate found a person', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: false,
      duplicateField: null,
      existingPerson: {
        id: 'person-existing',
        email: 'x@x.com',
        phone: null,
        dateOfBirth: null,
      },
      hasActiveProfile: false,
    })
    mockProgramProfileCreate.mockResolvedValue({ id: 'pp-reuse' })
    await registerMahadStudent(baseInput)
    expect(mockPersonFindMany).not.toHaveBeenCalled()
  })
})
