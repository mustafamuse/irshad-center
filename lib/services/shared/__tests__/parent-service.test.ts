import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPersonUpdate,
  mockPersonFindUnique,
  mockContactPointCreate,
  mockContactPointUpdate,
  mockContactPointFindFirst,
  mockContactPointDelete,
  mockTransaction,
} = vi.hoisted(() => ({
  mockPersonUpdate: vi.fn(),
  mockPersonFindUnique: vi.fn(),
  mockContactPointCreate: vi.fn(),
  mockContactPointUpdate: vi.fn(),
  mockContactPointFindFirst: vi.fn(),
  mockContactPointDelete: vi.fn(),
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
      findFirst: (...args: unknown[]) => mockContactPointFindFirst(...args),
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
  mockContactPointFindFirst.mockResolvedValue(null)
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      person: {
        update: (...args: unknown[]) => mockPersonUpdate(...args),
        findUnique: (...args: unknown[]) => mockPersonFindUnique(...args),
      },
      contactPoint: {
        create: (...args: unknown[]) => mockContactPointCreate(...args),
        update: (...args: unknown[]) => mockContactPointUpdate(...args),
        findFirst: (...args: unknown[]) => mockContactPointFindFirst(...args),
        delete: (...args: unknown[]) => mockContactPointDelete(...args),
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

const mockGuardianWithPhone = {
  id: 'guardian-1',
  name: 'Test Guardian',
  contactPoints: [
    {
      id: 'cp-phone-1',
      type: 'PHONE',
      value: '6125551234',
      isPrimary: true,
      isActive: true,
    },
  ],
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

  it('should delete conflicting deactivated contact before updating active contact value', async () => {
    const conflicting = {
      id: 'cp-conflict-1',
      type: 'EMAIL',
      value: 'new@example.com',
    }
    mockPersonFindUnique
      .mockResolvedValueOnce(mockGuardianWithEmail)
      .mockResolvedValueOnce(mockGuardianWithEmail)
    mockContactPointFindFirst.mockResolvedValueOnce(conflicting)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'new@example.com',
    })

    expect(mockContactPointDelete).toHaveBeenCalledWith({
      where: { id: 'cp-conflict-1' },
    })
    expect(mockContactPointUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cp-email-1' } })
    )
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

  it('should reactivate deactivated email contact instead of creating duplicate', async () => {
    const deactivatedContact = {
      id: 'cp-deactivated-1',
      type: 'EMAIL',
      value: 'same@example.com',
      isActive: false,
    }
    mockPersonFindUnique
      .mockResolvedValueOnce(mockGuardianNoContacts)
      .mockResolvedValueOnce(mockGuardianNoContacts)
    mockContactPointFindFirst.mockResolvedValue(deactivatedContact)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      email: 'same@example.com',
    })

    expect(mockContactPointUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cp-deactivated-1' },
        data: { isActive: true, isPrimary: true, deactivatedAt: null },
      })
    )
    expect(mockContactPointCreate).not.toHaveBeenCalled()
  })

  it('should update existing phone contact when one exists', async () => {
    mockPersonFindUnique
      .mockResolvedValueOnce(mockGuardianWithPhone)
      .mockResolvedValueOnce(mockGuardianWithPhone)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      phone: '612-555-9999',
    })

    expect(mockContactPointUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cp-phone-1' },
        data: { value: '6125559999' },
      })
    )
    expect(mockContactPointCreate).not.toHaveBeenCalled()
  })

  it('should create new phone contact when none exists', async () => {
    mockPersonFindUnique
      .mockResolvedValueOnce(mockGuardianNoContacts)
      .mockResolvedValueOnce(mockGuardianNoContacts)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      phone: '612-555-9999',
    })

    expect(mockContactPointCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          personId: 'guardian-1',
          type: 'PHONE',
          value: '6125559999',
          isPrimary: true,
        },
      })
    )
  })

  it('should reactivate deactivated phone contact instead of creating duplicate', async () => {
    const deactivatedPhone = {
      id: 'cp-deactivated-phone-1',
      type: 'PHONE',
      value: '6125559999',
      isActive: false,
    }
    mockPersonFindUnique
      .mockResolvedValueOnce(mockGuardianNoContacts)
      .mockResolvedValueOnce(mockGuardianNoContacts)
    mockContactPointFindFirst.mockResolvedValue(deactivatedPhone)

    await updateGuardianInfo('guardian-1', {
      firstName: 'Test',
      lastName: 'Guardian',
      phone: '612-555-9999',
    })

    expect(mockContactPointUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cp-deactivated-phone-1' },
        data: { isActive: true, isPrimary: true, deactivatedAt: null },
      })
    )
    expect(mockContactPointCreate).not.toHaveBeenCalled()
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
