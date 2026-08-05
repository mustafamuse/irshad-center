import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockUpdatePersonFields,
  mockFindPersonByEmail,
  mockFindPersonByEmailUnique,
  mockCreatePerson,
  mockFindGuardianRelationshipByRole,
  mockCreateGuardianRelationshipByRole,
  mockReactivateGuardianRelationshipWithEndDate,
  mockFindPersonByEmailWithActiveDependents,
} = vi.hoisted(() => ({
  mockUpdatePersonFields: vi.fn(),
  mockFindPersonByEmail: vi.fn(),
  mockFindPersonByEmailUnique: vi.fn(),
  mockCreatePerson: vi.fn(),
  mockFindGuardianRelationshipByRole: vi.fn(),
  mockCreateGuardianRelationshipByRole: vi.fn(),
  mockReactivateGuardianRelationshipWithEndDate: vi.fn(),
  mockFindPersonByEmailWithActiveDependents: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {},
}))

vi.mock('@/lib/db/queries/person', () => ({
  updatePersonFields: (...args: unknown[]) => mockUpdatePersonFields(...args),
  findPersonByEmail: (...args: unknown[]) => mockFindPersonByEmail(...args),
  findPersonByEmailUnique: (...args: unknown[]) =>
    mockFindPersonByEmailUnique(...args),
  createPerson: (...args: unknown[]) => mockCreatePerson(...args),
  findPersonByEmailWithProfiles: vi.fn(),
  findPersonByEmailWithActiveDependents: (...args: unknown[]) =>
    mockFindPersonByEmailWithActiveDependents(...args),
}))

vi.mock('@/lib/db/queries/relationships', () => ({
  findGuardianRelationshipByRole: (...args: unknown[]) =>
    mockFindGuardianRelationshipByRole(...args),
  createGuardianRelationshipByRole: (...args: unknown[]) =>
    mockCreateGuardianRelationshipByRole(...args),
  reactivateGuardianRelationshipWithEndDate: (...args: unknown[]) =>
    mockReactivateGuardianRelationshipWithEndDate(...args),
  findActiveGuardianRelationshipByRole: vi.fn(),
  deactivateGuardianRelationship: vi.fn(),
  getGuardianDependentRelationships: vi.fn(),
  getDependentGuardianRelationships: vi.fn(),
}))

vi.mock('@/lib/utils/contact-normalization', () => ({
  normalizeEmail: (email: string | undefined | null) =>
    email ? email.trim().toLowerCase() : null,
  normalizePhone: (phone: string | undefined | null) =>
    phone ? phone.replace(/\D/g, '') : null,
}))

import { ActionError } from '@/lib/errors/action-error'

import {
  updateGuardianInfo,
  addGuardianRelationship,
  guardianHasActiveDugsiChildren,
} from '../parent-service'

beforeEach(() => {
  vi.clearAllMocks()
})

const mockGuardianWithEmail = {
  id: 'guardian-1',
  name: 'Test Guardian',
  email: 'old@example.com',
  phone: null,
}

const mockGuardianNoContacts = {
  id: 'guardian-1',
  name: 'Test Guardian',
  email: null,
  phone: null,
}

const mockGuardianWithPhone = {
  id: 'guardian-1',
  name: 'Test Guardian',
  email: null,
  phone: '6125551234',
}

describe('updateGuardianInfo', () => {
  it('should update guardian name', async () => {
    mockUpdatePersonFields.mockResolvedValue(mockGuardianWithEmail)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'new@example.com',
    })

    expect(mockUpdatePersonFields).toHaveBeenCalledWith(
      'guardian-1',
      expect.objectContaining({ name: 'Test Guardian' }),
      expect.anything()
    )
  })

  it('should update email on Person when provided', async () => {
    mockUpdatePersonFields.mockResolvedValue(mockGuardianWithEmail)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'new@example.com',
    })

    expect(mockUpdatePersonFields).toHaveBeenCalledWith(
      'guardian-1',
      expect.objectContaining({ email: 'new@example.com' }),
      expect.anything()
    )
  })

  it('should update phone on Person when provided', async () => {
    mockUpdatePersonFields.mockResolvedValue(mockGuardianWithPhone)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      phone: '612-555-9999',
    })

    expect(mockUpdatePersonFields).toHaveBeenCalledWith(
      'guardian-1',
      expect.objectContaining({ phone: '6125559999' }),
      expect.anything()
    )
  })

  it('should set email on Person when none exists', async () => {
    mockUpdatePersonFields.mockResolvedValue(mockGuardianNoContacts)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'new@example.com',
    })

    expect(mockUpdatePersonFields).toHaveBeenCalledWith(
      'guardian-1',
      expect.objectContaining({ email: 'new@example.com' }),
      expect.anything()
    )
  })

  it('should set phone on Person when none exists', async () => {
    mockUpdatePersonFields.mockResolvedValue(mockGuardianNoContacts)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      phone: '612-555-9999',
    })

    expect(mockUpdatePersonFields).toHaveBeenCalledWith(
      'guardian-1',
      expect.objectContaining({ phone: '6125559999' }),
      expect.anything()
    )
  })

  it('should clear email (set null) when empty string provided', async () => {
    mockUpdatePersonFields.mockResolvedValue(mockGuardianWithEmail)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: '',
    })

    expect(mockUpdatePersonFields).toHaveBeenCalledWith(
      'guardian-1',
      expect.objectContaining({ email: null }),
      expect.anything()
    )
  })

  it('should clear phone (set null) when empty string provided', async () => {
    mockUpdatePersonFields.mockResolvedValue(mockGuardianWithPhone)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      phone: '',
    })

    expect(mockUpdatePersonFields).toHaveBeenCalledWith(
      'guardian-1',
      expect.objectContaining({ phone: null }),
      expect.anything()
    )
  })

  it('should pass phone as undefined when not provided (Prisma skips field)', async () => {
    mockUpdatePersonFields.mockResolvedValue(mockGuardianWithPhone)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
    })

    expect(mockUpdatePersonFields).toHaveBeenCalledWith(
      'guardian-1',
      expect.objectContaining({ phone: undefined }),
      expect.anything()
    )
  })
})

describe('addGuardianRelationship', () => {
  const defaultInput = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: '  Jane@Example.COM  ',
    phone: '612-555-1234',
  }

  const dependentId = 'dependent-1'

  beforeEach(() => {
    mockFindGuardianRelationshipByRole.mockResolvedValue(null)
  })

  it('should create new Person with normalized email/phone when no match found', async () => {
    mockFindPersonByEmail.mockResolvedValue(null)
    const createdPerson = {
      id: 'new-person-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '6125551234',
    }
    mockCreatePerson.mockResolvedValue(createdPerson)
    mockCreateGuardianRelationshipByRole.mockResolvedValue({
      id: 'rel-1',
      guardianId: 'new-person-1',
      dependentId,
      role: 'PARENT',
      isActive: true,
    })

    await addGuardianRelationship(dependentId, defaultInput)

    expect(mockCreatePerson).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        phone: '6125551234',
      })
    )
  })

  it('should reuse existing Person when email matches', async () => {
    const existingPerson = {
      id: 'existing-person-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '6125559999',
    }
    mockFindPersonByEmail.mockResolvedValue(existingPerson)
    mockCreateGuardianRelationshipByRole.mockResolvedValue({
      id: 'rel-1',
      guardianId: 'existing-person-1',
      dependentId,
      role: 'PARENT',
      isActive: true,
    })

    await addGuardianRelationship(dependentId, defaultInput)

    expect(mockCreatePerson).not.toHaveBeenCalled()
    expect(mockCreateGuardianRelationshipByRole).toHaveBeenCalledWith(
      'existing-person-1',
      dependentId,
      'PARENT'
    )
  })

  it('should handle P2002 race condition on person create', async () => {
    const { Prisma } = await import('@prisma/client')
    mockFindPersonByEmail.mockResolvedValue(null)

    const p2002Error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      { code: 'P2002', clientVersion: '6.0.0' }
    )
    mockCreatePerson.mockRejectedValue(p2002Error)

    const conflictingPerson = {
      id: 'conflict-person-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '6125551234',
    }
    mockFindPersonByEmailUnique.mockResolvedValue(conflictingPerson)
    mockCreateGuardianRelationshipByRole.mockResolvedValue({
      id: 'rel-1',
      guardianId: 'conflict-person-1',
      dependentId,
      role: 'PARENT',
      isActive: true,
    })

    await addGuardianRelationship(dependentId, defaultInput)

    expect(mockFindPersonByEmailUnique).toHaveBeenCalledWith('jane@example.com')
    expect(mockCreateGuardianRelationshipByRole).toHaveBeenCalledWith(
      'conflict-person-1',
      dependentId,
      'PARENT'
    )
  })

  it('should reject missing email', async () => {
    await expect(
      addGuardianRelationship(dependentId, {
        firstName: 'Jane',
        lastName: 'Doe',
        email: '',
        phone: '612-555-1234',
      })
    ).rejects.toThrow(ActionError)

    await expect(
      addGuardianRelationship(dependentId, {
        firstName: 'Jane',
        lastName: 'Doe',
        email: '',
        phone: '612-555-1234',
      })
    ).rejects.toThrow('Guardian email is required')
  })
})

describe('guardianHasActiveDugsiChildren', () => {
  function guardianWithDependents(
    profiles: { program: string; status: string }[][]
  ) {
    return {
      id: 'guardian-1',
      email: 'parent@example.com',
      dependentRelationships: profiles.map((programProfiles, i) => ({
        dependent: { id: `child-${i}`, programProfiles },
      })),
    }
  }

  it('returns false when no person matches the email', async () => {
    mockFindPersonByEmailWithActiveDependents.mockResolvedValue(null)

    await expect(
      guardianHasActiveDugsiChildren('parent@example.com')
    ).resolves.toBe(false)
  })

  it('returns false when all Dugsi children are withdrawn', async () => {
    mockFindPersonByEmailWithActiveDependents.mockResolvedValue(
      guardianWithDependents([
        [{ program: 'DUGSI_PROGRAM', status: 'WITHDRAWN' }],
        [{ program: 'DUGSI_PROGRAM', status: 'WITHDRAWN' }],
      ])
    )

    await expect(
      guardianHasActiveDugsiChildren('parent@example.com')
    ).resolves.toBe(false)
  })

  it('returns true when at least one Dugsi child is not withdrawn', async () => {
    mockFindPersonByEmailWithActiveDependents.mockResolvedValue(
      guardianWithDependents([
        [{ program: 'DUGSI_PROGRAM', status: 'WITHDRAWN' }],
        [{ program: 'DUGSI_PROGRAM', status: 'ENROLLED' }],
      ])
    )

    await expect(
      guardianHasActiveDugsiChildren('parent@example.com')
    ).resolves.toBe(true)
  })

  it('ignores non-Dugsi profiles', async () => {
    mockFindPersonByEmailWithActiveDependents.mockResolvedValue(
      guardianWithDependents([
        [{ program: 'MAHAD_PROGRAM', status: 'ENROLLED' }],
      ])
    )

    await expect(
      guardianHasActiveDugsiChildren('parent@example.com')
    ).resolves.toBe(false)
  })
})
