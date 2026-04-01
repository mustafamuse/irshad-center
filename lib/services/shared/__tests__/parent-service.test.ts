import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPersonUpdate,
  mockPersonFindUnique,
  mockPersonFindFirst,
  mockPersonCreate,
  mockGuardianRelationshipFindFirst,
  mockGuardianRelationshipCreate,
  mockGuardianRelationshipUpdate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockPersonUpdate: vi.fn(),
  mockPersonFindUnique: vi.fn(),
  mockPersonFindFirst: vi.fn(),
  mockPersonCreate: vi.fn(),
  mockGuardianRelationshipFindFirst: vi.fn(),
  mockGuardianRelationshipCreate: vi.fn(),
  mockGuardianRelationshipUpdate: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      update: (...args: unknown[]) => mockPersonUpdate(...args),
      findUnique: (...args: unknown[]) => mockPersonFindUnique(...args),
      findFirst: (...args: unknown[]) => mockPersonFindFirst(...args),
      create: (...args: unknown[]) => mockPersonCreate(...args),
    },
    guardianRelationship: {
      findFirst: (...args: unknown[]) =>
        mockGuardianRelationshipFindFirst(...args),
      create: (...args: unknown[]) => mockGuardianRelationshipCreate(...args),
      update: (...args: unknown[]) => mockGuardianRelationshipUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/utils/contact-normalization', () => ({
  normalizeEmail: (email: string | undefined | null) =>
    email ? email.trim().toLowerCase() : null,
  normalizePhone: (phone: string | undefined | null) => {
    if (!phone) return null
    const trimmed = phone.trim()
    if (trimmed.startsWith('+')) {
      const digits = trimmed.replace(/\D/g, '')
      return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null
    }
    const digits = trimmed.replace(/\D/g, '')
    if (digits.length === 10) return `+1${digits}`
    if (digits.length >= 11 && digits.length <= 15) return `+${digits}`
    return null
  },
}))

import { ActionError } from '@/lib/errors/action-error'

import { updateGuardianInfo, addGuardianRelationship } from '../parent-service'

beforeEach(() => {
  vi.clearAllMocks()
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      person: {
        update: (...args: unknown[]) => mockPersonUpdate(...args),
        findUnique: (...args: unknown[]) => mockPersonFindUnique(...args),
      },
    }
    return fn(tx)
  })
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
    mockPersonFindUnique.mockResolvedValue(mockGuardianWithEmail)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'new@example.com',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'guardian-1' },
        data: expect.objectContaining({ name: 'Test Guardian' }),
      })
    )
  })

  it('should update email on Person when provided', async () => {
    mockPersonFindUnique.mockResolvedValue(mockGuardianWithEmail)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'new@example.com',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'new@example.com' }),
      })
    )
  })

  it('should update phone on Person when provided', async () => {
    mockPersonFindUnique.mockResolvedValue(mockGuardianWithPhone)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      phone: '612-555-9999',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+16125559999' }),
      })
    )
  })

  it('should set email on Person when none exists', async () => {
    mockPersonFindUnique.mockResolvedValue(mockGuardianNoContacts)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'new@example.com',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'new@example.com' }),
      })
    )
  })

  it('should set phone on Person when none exists', async () => {
    mockPersonFindUnique.mockResolvedValue(mockGuardianNoContacts)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      phone: '612-555-9999',
    })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+16125559999' }),
      })
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
    mockGuardianRelationshipFindFirst.mockResolvedValue(null)
  })

  it('should create new Person with normalized email/phone when no match found', async () => {
    mockPersonFindFirst.mockResolvedValue(null)
    const createdPerson = {
      id: 'new-person-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+16125551234',
    }
    mockPersonCreate.mockResolvedValue(createdPerson)
    mockGuardianRelationshipCreate.mockResolvedValue({
      id: 'rel-1',
      guardianId: 'new-person-1',
      dependentId,
      role: 'PARENT',
      isActive: true,
    })

    await addGuardianRelationship(dependentId, defaultInput)

    expect(mockPersonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'jane@example.com',
          phone: '+16125551234',
        }),
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
    mockPersonFindFirst.mockResolvedValue(existingPerson)
    mockGuardianRelationshipCreate.mockResolvedValue({
      id: 'rel-1',
      guardianId: 'existing-person-1',
      dependentId,
      role: 'PARENT',
      isActive: true,
    })

    await addGuardianRelationship(dependentId, defaultInput)

    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockGuardianRelationshipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          guardianId: 'existing-person-1',
          dependentId,
        }),
      })
    )
  })

  it('should handle P2002 race condition on person create', async () => {
    const { Prisma } = await import('@prisma/client')
    mockPersonFindFirst.mockResolvedValue(null)

    const p2002Error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      { code: 'P2002', clientVersion: '6.0.0' }
    )
    mockPersonCreate.mockRejectedValue(p2002Error)

    const conflictingPerson = {
      id: 'conflict-person-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '6125551234',
    }
    mockPersonFindUnique.mockResolvedValue(conflictingPerson)
    mockGuardianRelationshipCreate.mockResolvedValue({
      id: 'rel-1',
      guardianId: 'conflict-person-1',
      dependentId,
      role: 'PARENT',
      isActive: true,
    })

    await addGuardianRelationship(dependentId, defaultInput)

    expect(mockPersonFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'jane@example.com' },
      })
    )
    expect(mockGuardianRelationshipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          guardianId: 'conflict-person-1',
          dependentId,
        }),
      })
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
