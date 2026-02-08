/**
 * Dugsi Family Service Tests
 *
 * Tests for addChildToFamily: shift inheritance and guardian copying.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetProgramProfileById,
  mockPersonCreate,
  mockGuardianRelationshipCreateMany,
  mockProgramProfileCreate,
  mockEnrollmentCreate,
  mockTransaction,
} = vi.hoisted(() => {
  const mockPersonCreate = vi.fn()
  const mockGuardianRelationshipCreateMany = vi.fn()
  const mockProgramProfileCreate = vi.fn()
  const mockEnrollmentCreate = vi.fn()

  const tx = {
    person: { create: (...args: unknown[]) => mockPersonCreate(...args) },
    guardianRelationship: {
      createMany: (...args: unknown[]) =>
        mockGuardianRelationshipCreateMany(...args),
    },
    programProfile: {
      create: (...args: unknown[]) => mockProgramProfileCreate(...args),
    },
    enrollment: {
      create: (...args: unknown[]) => mockEnrollmentCreate(...args),
    },
  }

  const mockTransaction = vi.fn(
    async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)
  )

  return {
    mockGetProgramProfileById: vi.fn(),
    mockPersonCreate,
    mockGuardianRelationshipCreateMany,
    mockProgramProfileCreate,
    mockEnrollmentCreate,
    mockTransaction,
  }
})

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfileById: (...args: unknown[]) =>
    mockGetProgramProfileById(...args),
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

import { addChildToFamily } from '../family-service'

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
