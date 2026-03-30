import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPersonUpdate, mockPersonFindUnique, mockTransaction } = vi.hoisted(
  () => ({
    mockPersonUpdate: vi.fn(),
    mockPersonFindUnique: vi.fn(),
    mockTransaction: vi.fn(),
  })
)

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      update: (...args: unknown[]) => mockPersonUpdate(...args),
      findUnique: (...args: unknown[]) => mockPersonFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/utils/contact-normalization', () => ({
  normalizeEmail: (email: string | undefined | null) =>
    email ? email.trim().toLowerCase() : null,
  normalizePhone: (phone: string | undefined | null) =>
    phone ? phone.replace(/\D/g, '') : null,
}))

import { updateGuardianInfo } from '../parent-service'

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
        data: expect.objectContaining({ phone: '6125559999' }),
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
        data: expect.objectContaining({ phone: '6125559999' }),
      })
    )
  })
})
