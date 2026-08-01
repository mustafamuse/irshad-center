import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFindFirst, mockFindMany } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

vi.mock('@/lib/constants/mahad', () => ({
  MAHAD_PROGRAM: 'MAHAD_PROGRAM',
}))

import {
  findMahadProfileByEmail,
  findMahadProfileById,
  findMahadProfilesByDob,
} from '../mahad-verification'

const baseRaw = {
  id: 'profile-1',
  createdAt: new Date('2026-01-15T08:30:00.000Z'),
  status: 'REGISTERED' as const,
  person: {
    name: 'Mohamed Ali',
    billingAccounts: [],
  },
  assignments: [],
}

describe('findMahadProfileById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null for empty input without querying', async () => {
    const result = await findMahadProfileById('')
    expect(result).toBeNull()
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('returns null when no profile found', async () => {
    mockFindFirst.mockResolvedValue(null)
    const result = await findMahadProfileById('missing')
    expect(result).toBeNull()
  })

  it('filters by id AND program', async () => {
    mockFindFirst.mockResolvedValue(baseRaw)
    await findMahadProfileById('profile-1')
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'profile-1', program: 'MAHAD_PROGRAM' },
      })
    )
  })

  it('maps raw row to candidate with hasStripeCustomer false when no billing account', async () => {
    mockFindFirst.mockResolvedValue(baseRaw)
    const result = await findMahadProfileById('profile-1')
    expect(result).toEqual({
      profileId: 'profile-1',
      fullName: 'Mohamed Ali',
      registeredAt: baseRaw.createdAt,
      enrollmentStatus: 'REGISTERED',
      hasStripeCustomer: false,
      subscriptionStatus: null,
    })
  })

  it('sets hasStripeCustomer true when stripeCustomerIdMahad is populated', async () => {
    mockFindFirst.mockResolvedValue({
      ...baseRaw,
      person: {
        ...baseRaw.person,
        billingAccounts: [{ stripeCustomerIdMahad: 'cus_xxx' }],
      },
    })
    const result = await findMahadProfileById('profile-1')
    expect(result?.hasStripeCustomer).toBe(true)
  })

  it('extracts subscription status from active assignment', async () => {
    mockFindFirst.mockResolvedValue({
      ...baseRaw,
      assignments: [{ subscription: { status: 'active' } }],
    })
    const result = await findMahadProfileById('profile-1')
    expect(result?.subscriptionStatus).toBe('active')
  })
})

describe('findMahadProfileByEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null for empty input without querying', async () => {
    const result = await findMahadProfileByEmail('')
    expect(result).toBeNull()
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('queries by program AND person.email', async () => {
    mockFindFirst.mockResolvedValue(baseRaw)
    await findMahadProfileByEmail('mohamed@test.com')
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          program: 'MAHAD_PROGRAM',
          person: { email: 'mohamed@test.com' },
        },
      })
    )
  })
})

describe('findMahadProfilesByDob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries by program AND person.dateOfBirth', async () => {
    mockFindMany.mockResolvedValue([])
    const dob = new Date('2005-03-15')
    await findMahadProfilesByDob(dob)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          program: 'MAHAD_PROGRAM',
          person: { dateOfBirth: dob },
        },
        take: 10,
      })
    )
  })

  it('maps each row through candidate transformation', async () => {
    mockFindMany.mockResolvedValue([
      baseRaw,
      {
        ...baseRaw,
        id: 'profile-2',
        person: { ...baseRaw.person, name: 'Aisha Hassan' },
      },
    ])
    const candidates = await findMahadProfilesByDob(new Date('2005-03-15'))
    expect(candidates).toHaveLength(2)
    expect(candidates[0]?.fullName).toBe('Mohamed Ali')
    expect(candidates[1]?.fullName).toBe('Aisha Hassan')
  })

  it('returns empty array when no profiles match', async () => {
    mockFindMany.mockResolvedValue([])
    const candidates = await findMahadProfilesByDob(new Date('1990-01-01'))
    expect(candidates).toEqual([])
  })
})
