import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

vi.mock('@/lib/constants/mahad', () => ({
  MAHAD_PROGRAM: 'MAHAD_PROGRAM',
}))

import {
  findMahadRegistrationByNameAndPhoneLast4,
  getFirstNameFromFullName,
  getLastNameFromFullName,
  pickMahadRegistrationMatch,
  type MahadPublicLookupCandidate,
} from '../mahad-public-lookup'

function candidate(name: string): MahadPublicLookupCandidate {
  return {
    status: 'REGISTERED',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    person: { name },
  }
}

describe('mahad public lookup helpers', () => {
  it('extracts the first and last tokens from a full name', () => {
    expect(getFirstNameFromFullName('Abdi Nur Hassan')).toBe('Abdi')
    expect(getLastNameFromFullName('Abdi Nur Hassan')).toBe('Hassan')
    expect(getFirstNameFromFullName('  Fatima   Ali  ')).toBe('Fatima')
    expect(getLastNameFromFullName('  Fatima   Ali  ')).toBe('Ali')
    expect(getFirstNameFromFullName('')).toBe('')
    expect(getLastNameFromFullName('')).toBe('')
  })

  it('disambiguates siblings who share a last name and household phone', () => {
    const siblings = [candidate('Amina Hassan'), candidate('Abdi Hassan')]

    expect(
      pickMahadRegistrationMatch(siblings, 'amina', 'hassan')
    ).toMatchObject({ person: { name: 'Amina Hassan' } })
    expect(
      pickMahadRegistrationMatch(siblings, 'abdi', 'hassan')
    ).toMatchObject({ person: { name: 'Abdi Hassan' } })
  })

  it('returns null when no profile matches first + last name', () => {
    expect(
      pickMahadRegistrationMatch([candidate('Amina Ali')], 'fatima', 'ali')
    ).toBeNull()
    expect(
      pickMahadRegistrationMatch([candidate('Amina Ali')], 'amina', 'hassan')
    ).toBeNull()
  })

  it('returns the unique matching profile from a mixed result set', () => {
    expect(
      pickMahadRegistrationMatch(
        [candidate('Amina Ali'), candidate('Abdi Hassan')],
        'abdi',
        'hassan'
      )
    ).toMatchObject({ person: { name: 'Abdi Hassan' } })
  })
})

describe('findMahadRegistrationByNameAndPhoneLast4', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { found: false } without querying when phone last-4 is malformed', async () => {
    const result = await findMahadRegistrationByNameAndPhoneLast4(
      'Abdi',
      'Hassan',
      '12a4'
    )

    expect(result).toEqual({ found: false })
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('returns { found: false } without querying when firstName is empty after trim', async () => {
    const result = await findMahadRegistrationByNameAndPhoneLast4(
      '   ',
      'Hassan',
      '1234'
    )

    expect(result).toEqual({ found: false })
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('returns { found: false } without querying when lastName is empty after trim', async () => {
    const result = await findMahadRegistrationByNameAndPhoneLast4(
      'Abdi',
      '   ',
      '1234'
    )

    expect(result).toEqual({ found: false })
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('filters by MAHAD program + trailing 4 digits of phone', async () => {
    mockFindMany.mockResolvedValue([])

    await findMahadRegistrationByNameAndPhoneLast4('Abdi', 'Hassan', '1234')

    expect(mockFindMany).toHaveBeenCalledTimes(1)
    const args = mockFindMany.mock.calls[0]![0]
    expect(args.where).toMatchObject({
      program: 'MAHAD_PROGRAM',
      person: { phone: { endsWith: '1234' } },
    })
    expect(args.select.person.select).toEqual({ name: true })
  })

  it('normalizes names case-insensitively and returns the matched profile payload', async () => {
    mockFindMany.mockResolvedValue([
      {
        status: 'ENROLLED',
        createdAt: new Date('2026-02-15T08:30:00.000Z'),
        person: { name: 'Abdi Hassan' },
      },
    ])

    const result = await findMahadRegistrationByNameAndPhoneLast4(
      'ABDI',
      'HASSAN',
      '5678'
    )

    expect(result).toEqual({
      found: true,
      studentName: 'Abdi Hassan',
      registeredAt: '2026-02-15',
      programStatusLabel: 'Enrolled',
    })
  })

  it('returns { found: false } when multiple candidates collide on first + last name', async () => {
    mockFindMany.mockResolvedValue([
      {
        status: 'REGISTERED',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        person: { name: 'Abdi Hassan' },
      },
      {
        status: 'REGISTERED',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        person: { name: 'Abdi Hassan' },
      },
    ])

    const result = await findMahadRegistrationByNameAndPhoneLast4(
      'Abdi',
      'Hassan',
      '9999'
    )

    expect(result).toEqual({ found: false })
  })

  it('returns a human-readable label for every EnrollmentStatus value', async () => {
    const cases: Array<[string, string]> = [
      ['REGISTERED', 'Registered'],
      ['ENROLLED', 'Enrolled'],
      ['ON_LEAVE', 'On leave'],
      ['WITHDRAWN', 'Withdrawn'],
      ['COMPLETED', 'Completed'],
      ['SUSPENDED', 'Suspended'],
    ]

    for (const [status, expectedLabel] of cases) {
      mockFindMany.mockResolvedValueOnce([
        {
          status,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          person: { name: 'Amina Ali' },
        },
      ])

      const result = await findMahadRegistrationByNameAndPhoneLast4(
        'Amina',
        'Ali',
        '0000'
      )

      expect(result).toMatchObject({
        found: true,
        programStatusLabel: expectedLabel,
      })
    }
  })
})
