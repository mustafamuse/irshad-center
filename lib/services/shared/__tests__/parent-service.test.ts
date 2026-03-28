import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPersonUpdate,
  mockPersonFindUnique,
  mockContactPointCreate,
  mockContactPointUpdate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockPersonUpdate: vi.fn(),
  mockPersonFindUnique: vi.fn(),
  mockContactPointCreate: vi.fn(),
  mockContactPointUpdate: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      update: (...args: unknown[]) => mockPersonUpdate(...args),
      findUnique: (...args: unknown[]) => mockPersonFindUnique(...args),
    },
    contactPoint: {
      create: (...args: unknown[]) => mockContactPointCreate(...args),
      update: (...args: unknown[]) => mockContactPointUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/utils/contact-normalization', () => ({
  normalizePhone: (phone: string) => phone.replace(/\D/g, ''),
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
      contactPoint: {
        create: (...args: unknown[]) => mockContactPointCreate(...args),
        update: (...args: unknown[]) => mockContactPointUpdate(...args),
      },
    }
    return fn(tx)
  })
})

const mockGuardianWithEmail = {
  id: 'guardian-1',
  name: 'Test Guardian',
  contactPoints: [
    {
      id: 'cp-email-1',
      type: 'EMAIL',
      value: 'old@example.com',
      isPrimary: true,
      isActive: true,
    },
  ],
}

const mockGuardianNoContacts = {
  id: 'guardian-1',
  name: 'Test Guardian',
  contactPoints: [],
}

describe('updateGuardianInfo', () => {
  it('should filter contactPoints by isActive: true when loading guardian', async () => {
    mockPersonFindUnique
      .mockResolvedValueOnce(mockGuardianWithEmail)
      .mockResolvedValueOnce(mockGuardianWithEmail)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'new@example.com',
    })

    const loadCall = mockPersonFindUnique.mock.calls[0][0]
    expect(loadCall.include.contactPoints).toEqual({
      where: { isActive: true },
    })
  })

  it('should update existing email contact when one exists', async () => {
    mockPersonFindUnique
      .mockResolvedValueOnce(mockGuardianWithEmail)
      .mockResolvedValueOnce(mockGuardianWithEmail)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'new@example.com',
    })

    expect(mockContactPointUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cp-email-1' },
        data: { value: 'new@example.com' },
      })
    )
    expect(mockContactPointCreate).not.toHaveBeenCalled()
  })

  it('should create new email contact when none exists', async () => {
    mockPersonFindUnique
      .mockResolvedValueOnce(mockGuardianNoContacts)
      .mockResolvedValueOnce(mockGuardianNoContacts)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'new@example.com',
    })

    expect(mockContactPointCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          personId: 'guardian-1',
          type: 'EMAIL',
          value: 'new@example.com',
          isPrimary: true,
        },
      })
    )
  })

  it('should not use try-catch P2002 pattern (removed dead code)', async () => {
    mockPersonFindUnique
      .mockResolvedValueOnce(mockGuardianNoContacts)
      .mockResolvedValueOnce(mockGuardianNoContacts)
    mockContactPointCreate.mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    )

    await expect(
      updateGuardianInfo('guardian-1', {
        firstName: 'Test',
        lastName: 'Guardian',
        email: 'taken@example.com',
      })
    ).rejects.toThrow()
  })
})
