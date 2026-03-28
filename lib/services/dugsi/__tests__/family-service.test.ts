import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetProgramProfileById,
  mockFindPersonByContact,
  mockPersonCreate,
  mockPersonUpdate,
  mockGuardianRelationshipCreate,
  mockGuardianRelationshipCreateMany,
  mockGuardianRelationshipFindFirst,
  mockGuardianRelationshipUpdate,
  mockProgramProfileCreate,
  mockEnrollmentCreate,
  mockContactPointUpdate,
  mockContactPointCreate,
  mockContactPointFindFirst,
  mockTransaction,
} = vi.hoisted(() => {
  const mockPersonCreate = vi.fn()
  const mockPersonUpdate = vi.fn()
  const mockGuardianRelationshipCreate = vi.fn()
  const mockGuardianRelationshipCreateMany = vi.fn()
  const mockGuardianRelationshipFindFirst = vi.fn()
  const mockGuardianRelationshipUpdate = vi.fn()
  const mockProgramProfileCreate = vi.fn()
  const mockEnrollmentCreate = vi.fn()
  const mockContactPointUpdate = vi.fn()
  const mockContactPointCreate = vi.fn()
  const mockContactPointFindFirst = vi.fn()

  const tx = {
    person: {
      create: mockPersonCreate,
      update: mockPersonUpdate,
    },
    guardianRelationship: {
      create: mockGuardianRelationshipCreate,
      createMany: mockGuardianRelationshipCreateMany,
      findFirst: mockGuardianRelationshipFindFirst,
      update: mockGuardianRelationshipUpdate,
    },
    programProfile: {
      create: mockProgramProfileCreate,
    },
    enrollment: {
      create: mockEnrollmentCreate,
    },
    contactPoint: {
      update: mockContactPointUpdate,
      create: mockContactPointCreate,
      findFirst: mockContactPointFindFirst,
    },
  }

  const mockTransaction = vi.fn(
    async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)
  )

  return {
    mockGetProgramProfileById: vi.fn(),
    mockFindPersonByContact: vi.fn(),
    mockPersonCreate,
    mockPersonUpdate,
    mockGuardianRelationshipCreate,
    mockGuardianRelationshipCreateMany,
    mockGuardianRelationshipFindFirst,
    mockGuardianRelationshipUpdate,
    mockProgramProfileCreate,
    mockEnrollmentCreate,
    mockContactPointUpdate,
    mockContactPointCreate,
    mockContactPointFindFirst,
    mockTransaction,
  }
})

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfileById: (...args: unknown[]) =>
    mockGetProgramProfileById(...args),
  findPersonByContact: (...args: unknown[]) => mockFindPersonByContact(...args),
}))

vi.mock('@/lib/constants/dugsi', () => ({
  DUGSI_PROGRAM: 'DUGSI',
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, fn: () => Promise<unknown>) => fn()),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: vi.fn(),
}))

import {
  addChildToFamily,
  addSecondParent,
  updateParentInfo,
} from '../family-service'

function makeExistingProfile(shift: 'MORNING' | 'AFTERNOON' | null) {
  return {
    id: 'existing-profile-id',
    program: 'DUGSI',
    familyReferenceId: 'family-123',
    shift,
    person: {
      id: 'existing-person-id',
      dependentRelationships: [
        { guardian: { id: 'guardian-1' } },
        { guardian: { id: 'guardian-2' } },
      ],
    },
  }
}

const baseInput = {
  existingStudentId: 'existing-profile-id',
  firstName: 'Ali',
  lastName: 'Hassan',
  gender: 'MALE' as const,
}

describe('addChildToFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPersonCreate.mockResolvedValue({ id: 'new-person-id' })
    mockGuardianRelationshipCreateMany.mockResolvedValue({ count: 2 })
    mockProgramProfileCreate.mockResolvedValue({ id: 'new-profile-id' })
    mockEnrollmentCreate.mockResolvedValue({ id: 'new-enrollment-id' })
  })

  it('should inherit MORNING shift from existing sibling', async () => {
    mockGetProgramProfileById.mockResolvedValue(makeExistingProfile('MORNING'))

    await addChildToFamily(baseInput)

    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ shift: 'MORNING' }),
    })
  })

  it('should inherit AFTERNOON shift from existing sibling', async () => {
    mockGetProgramProfileById.mockResolvedValue(
      makeExistingProfile('AFTERNOON')
    )

    await addChildToFamily(baseInput)

    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ shift: 'AFTERNOON' }),
    })
  })

  it('should handle null shift gracefully', async () => {
    mockGetProgramProfileById.mockResolvedValue(makeExistingProfile(null))

    await addChildToFamily(baseInput)

    expect(mockProgramProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ shift: null }),
    })
  })

  it('should copy guardian relationships from existing sibling', async () => {
    mockGetProgramProfileById.mockResolvedValue(makeExistingProfile('MORNING'))

    await addChildToFamily(baseInput)

    expect(mockGuardianRelationshipCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ guardianId: 'guardian-1' }),
        expect.objectContaining({ guardianId: 'guardian-2' }),
      ],
    })
  })

  it('should throw when existing student not found', async () => {
    mockGetProgramProfileById.mockResolvedValue(null)

    await expect(addChildToFamily(baseInput)).rejects.toThrow(
      'Existing student not found'
    )
  })

  it('should throw when no guardians found', async () => {
    mockGetProgramProfileById.mockResolvedValue({
      ...makeExistingProfile('MORNING'),
      person: { id: 'person-id', dependentRelationships: [] },
    })

    await expect(addChildToFamily(baseInput)).rejects.toThrow(
      'No guardians found for existing student'
    )
  })
})

describe('updateParentInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPersonUpdate.mockResolvedValue({ id: 'guardian-1' })
    mockContactPointUpdate.mockResolvedValue({ id: 'cp-1' })
  })

  it('should normalize phone before storing (612-555-1234 → 6125551234)', async () => {
    mockContactPointFindFirst.mockResolvedValue({
      id: 'cp-1',
      type: 'PHONE',
      value: '0000000000',
      isActive: true,
    })
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI',
      person: {
        id: 'person-1',
        dependentRelationships: [{ guardian: { id: 'guardian-1' } }],
      },
    })

    await updateParentInfo({
      studentId: 'profile-1',
      parentNumber: 1,
      firstName: 'Fatima',
      lastName: 'Ali',
      phone: '612-555-1234',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith({
      where: { id: 'guardian-1' },
      data: { name: 'Fatima Ali' },
    })
    expect(mockContactPointUpdate).toHaveBeenCalledWith({
      where: { id: 'cp-1' },
      data: { value: '6125551234' },
    })
  })

  it('should normalize phone when creating new contact point', async () => {
    mockContactPointFindFirst.mockResolvedValue(null)
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI',
      person: {
        id: 'person-1',
        dependentRelationships: [{ guardian: { id: 'guardian-1' } }],
      },
    })
    mockContactPointCreate.mockResolvedValue({ id: 'cp-new' })

    await updateParentInfo({
      studentId: 'profile-1',
      parentNumber: 1,
      firstName: 'Fatima',
      lastName: 'Ali',
      phone: '612-555-1234',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith({
      where: { id: 'guardian-1' },
      data: { name: 'Fatima Ali' },
    })
    expect(mockContactPointCreate).toHaveBeenCalledWith({
      data: {
        personId: 'guardian-1',
        type: 'PHONE',
        value: '6125551234',
        isPrimary: true,
      },
    })
  })

  it('should strip NANP country code (+16125551234 → 6125551234)', async () => {
    mockContactPointFindFirst.mockResolvedValue({
      id: 'cp-1',
      type: 'PHONE',
      value: '0000000000',
      isActive: true,
    })
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI',
      person: {
        id: 'person-1',
        dependentRelationships: [{ guardian: { id: 'guardian-1' } }],
      },
    })

    await updateParentInfo({
      studentId: 'profile-1',
      parentNumber: 1,
      firstName: 'Fatima',
      lastName: 'Ali',
      phone: '+1 (612) 555-1234',
    })

    expect(mockContactPointUpdate).toHaveBeenCalledWith({
      where: { id: 'cp-1' },
      data: { value: '6125551234' },
    })
  })

  it('should throw ActionError for invalid phone number', async () => {
    await expect(
      updateParentInfo({
        studentId: 'profile-1',
        parentNumber: 1,
        firstName: 'Fatima',
        lastName: 'Ali',
        phone: '123',
      })
    ).rejects.toThrow('Invalid phone number')
  })
})

describe('addSecondParent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPersonCreate.mockResolvedValue({ id: 'new-parent-id' })
    mockGuardianRelationshipCreate.mockResolvedValue({ id: 'rel-1' })
    mockGuardianRelationshipFindFirst.mockResolvedValue(null)
    mockFindPersonByContact.mockResolvedValue(null)
    mockContactPointFindFirst.mockResolvedValue(null)
    mockContactPointCreate.mockResolvedValue({ id: 'cp-new' })
    mockContactPointUpdate.mockResolvedValue({ id: 'cp-1' })
  })

  it('should normalize phone before storing (612-555-1234 → 6125551234)', async () => {
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI',
      person: {
        id: 'person-1',
        dependentRelationships: [{ guardian: { id: 'guardian-1' } }],
      },
    })

    await addSecondParent({
      studentId: 'profile-1',
      firstName: 'Ahmed',
      lastName: 'Ali',
      email: 'ahmed@example.com',
      phone: '612-555-1234',
    })

    expect(mockPersonCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactPoints: {
          create: expect.arrayContaining([
            expect.objectContaining({ type: 'PHONE', value: '6125551234' }),
          ]),
        },
      }),
    })
  })

  it('should reuse existing person and create phone when email already exists', async () => {
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI',
      person: {
        id: 'person-1',
        dependentRelationships: [{ guardian: { id: 'guardian-1' } }],
      },
    })
    mockFindPersonByContact.mockResolvedValue({ id: 'existing-parent-id' })
    mockContactPointFindFirst.mockResolvedValue(null)

    await addSecondParent({
      studentId: 'profile-1',
      firstName: 'Ahmed',
      lastName: 'Ali',
      email: 'ahmed@example.com',
      phone: '612-555-1234',
    })

    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockContactPointCreate).toHaveBeenCalledWith({
      data: {
        personId: 'existing-parent-id',
        type: 'PHONE',
        value: '6125551234',
        isPrimary: true,
      },
    })
    expect(mockGuardianRelationshipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ guardianId: 'existing-parent-id' }),
      })
    )
  })

  it('should update existing phone when reusing person', async () => {
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI',
      person: {
        id: 'person-1',
        dependentRelationships: [{ guardian: { id: 'guardian-1' } }],
      },
    })
    mockFindPersonByContact.mockResolvedValue({ id: 'existing-parent-id' })
    mockContactPointFindFirst.mockResolvedValue({
      id: 'cp-existing',
      type: 'PHONE',
      value: '0000000000',
      isActive: true,
    })

    await addSecondParent({
      studentId: 'profile-1',
      firstName: 'Ahmed',
      lastName: 'Ali',
      email: 'ahmed@example.com',
      phone: '612-555-1234',
    })

    expect(mockContactPointUpdate).toHaveBeenCalledWith({
      where: { id: 'cp-existing' },
      data: { value: '6125551234' },
    })
  })

  it('should skip create when active guardian relationship already exists', async () => {
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI',
      person: {
        id: 'person-1',
        dependentRelationships: [{ guardian: { id: 'guardian-1' } }],
      },
    })
    mockFindPersonByContact.mockResolvedValue({ id: 'existing-parent-id' })
    mockGuardianRelationshipFindFirst.mockResolvedValue({
      id: 'existing-rel',
      guardianId: 'existing-parent-id',
      dependentId: 'person-1',
      isActive: true,
    })

    await addSecondParent({
      studentId: 'profile-1',
      firstName: 'Ahmed',
      lastName: 'Ali',
      email: 'ahmed@example.com',
      phone: '612-555-1234',
    })

    expect(mockGuardianRelationshipCreate).not.toHaveBeenCalled()
    expect(mockGuardianRelationshipUpdate).not.toHaveBeenCalled()
    expect(mockContactPointCreate).toHaveBeenCalledWith({
      data: {
        personId: 'existing-parent-id',
        type: 'PHONE',
        value: '6125551234',
        isPrimary: true,
      },
    })
  })

  it('should reactivate soft-deleted guardian relationship', async () => {
    mockGetProgramProfileById.mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI',
      person: {
        id: 'person-1',
        dependentRelationships: [{ guardian: { id: 'guardian-1' } }],
      },
    })
    mockFindPersonByContact.mockResolvedValue({ id: 'existing-parent-id' })
    mockGuardianRelationshipFindFirst.mockResolvedValue({
      id: 'soft-deleted-rel',
      guardianId: 'existing-parent-id',
      dependentId: 'person-1',
      isActive: false,
    })
    mockGuardianRelationshipUpdate.mockResolvedValue({ id: 'soft-deleted-rel' })

    await addSecondParent({
      studentId: 'profile-1',
      firstName: 'Ahmed',
      lastName: 'Ali',
      email: 'ahmed@example.com',
      phone: '612-555-1234',
    })

    expect(mockGuardianRelationshipCreate).not.toHaveBeenCalled()
    expect(mockGuardianRelationshipUpdate).toHaveBeenCalledWith({
      where: { id: 'soft-deleted-rel' },
      data: { isActive: true, endDate: null },
    })
  })

  it('should throw ActionError for invalid phone number', async () => {
    await expect(
      addSecondParent({
        studentId: 'profile-1',
        firstName: 'Ahmed',
        lastName: 'Ali',
        email: 'ahmed@example.com',
        phone: '123',
      })
    ).rejects.toThrow('Invalid phone number')
  })
})
