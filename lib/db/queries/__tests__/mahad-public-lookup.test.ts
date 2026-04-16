import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockProfileFindMany } = vi.hoisted(() => ({
  mockProfileFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findMany: mockProfileFindMany,
    },
  },
}))

vi.mock('@/lib/constants/mahad', () => ({
  MAHAD_PROGRAM: 'IRSHAD_MAHAD',
}))

import {
  findMahadRegistrationByLastNameAndPhoneLast4,
  getLastNameFromFullName,
} from '../mahad-public-lookup'

describe('getLastNameFromFullName', () => {
  it('returns the last whitespace-delimited token', () => {
    expect(getLastNameFromFullName('Firstname Middle Lastname')).toBe('Lastname')
  })

  it('trims surrounding whitespace', () => {
    expect(getLastNameFromFullName('   Muhammad Ali   ')).toBe('Ali')
  })

  it('returns empty string for empty input', () => {
    expect(getLastNameFromFullName('')).toBe('')
    expect(getLastNameFromFullName('   ')).toBe('')
  })

  it('returns the only token when name has no space', () => {
    expect(getLastNameFromFullName('Plato')).toBe('Plato')
  })

  it('collapses multiple spaces', () => {
    expect(getLastNameFromFullName('Aisha    Bakr')).toBe('Bakr')
  })
})

describe('findMahadRegistrationByLastNameAndPhoneLast4', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects empty last name without hitting the database', async () => {
    const result = await findMahadRegistrationByLastNameAndPhoneLast4(
      '',
      '1234'
    )
    expect(result).toEqual({ found: false })
    expect(mockProfileFindMany).not.toHaveBeenCalled()
  })

  it('rejects phoneLast4 that is not exactly 4 digits', async () => {
    expect(
      await findMahadRegistrationByLastNameAndPhoneLast4('Ali', '12a4')
    ).toEqual({ found: false })
    expect(
      await findMahadRegistrationByLastNameAndPhoneLast4('Ali', '123')
    ).toEqual({ found: false })
    expect(
      await findMahadRegistrationByLastNameAndPhoneLast4('Ali', '12345')
    ).toEqual({ found: false })
    expect(mockProfileFindMany).not.toHaveBeenCalled()
  })

  it('returns found:false when no profiles match the last name', async () => {
    mockProfileFindMany.mockResolvedValue([
      {
        status: 'REGISTERED',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        person: { name: 'Zayd Omar' },
        enrollments: [],
      },
    ])

    const result = await findMahadRegistrationByLastNameAndPhoneLast4(
      'Ali',
      '1234'
    )

    expect(result).toEqual({ found: false })
  })

  it('returns the match when exactly one profile matches the last name', async () => {
    mockProfileFindMany.mockResolvedValue([
      {
        status: 'REGISTERED',
        createdAt: new Date('2025-06-15T10:00:00Z'),
        person: { name: 'Ahmed Ali' },
        enrollments: [{ status: 'ENROLLED' }],
      },
    ])

    const result = await findMahadRegistrationByLastNameAndPhoneLast4(
      'ALI',
      '1234'
    )

    expect(result).toEqual({
      found: true,
      studentName: 'Ahmed Ali',
      registeredAt: '2025-06-15T10:00:00.000Z',
      programStatusLabel: 'Registered',
      enrollmentStatusLabel: 'Enrolled',
    })
  })

  it('returns found:false when multiple profiles share the same last name (ambiguous)', async () => {
    // Two different people with the same last name and phone-suffix collision.
    // The query must NOT reveal a potentially wrong identity.
    mockProfileFindMany.mockResolvedValue([
      {
        status: 'REGISTERED',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        person: { name: 'Ahmed Ali' },
        enrollments: [],
      },
      {
        status: 'ENROLLED',
        createdAt: new Date('2025-02-01T00:00:00Z'),
        person: { name: 'Fatima Ali' },
        enrollments: [],
      },
    ])

    const result = await findMahadRegistrationByLastNameAndPhoneLast4(
      'Ali',
      '1234'
    )

    expect(result).toEqual({ found: false })
  })

  it('returns null enrollmentStatusLabel when no enrollments exist', async () => {
    mockProfileFindMany.mockResolvedValue([
      {
        status: 'REGISTERED',
        createdAt: new Date('2025-06-15T10:00:00Z'),
        person: { name: 'Sarah Khan' },
        enrollments: [],
      },
    ])

    const result = await findMahadRegistrationByLastNameAndPhoneLast4(
      'Khan',
      '9999'
    )

    expect(result).toMatchObject({
      found: true,
      enrollmentStatusLabel: null,
    })
  })
})
