import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockProfileFindMany,
  mockProfileFindUnique,
  mockProfileCount,
  mockPersonFindFirst,
} = vi.hoisted(() => ({
  mockProfileFindMany: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockProfileCount: vi.fn(),
  mockPersonFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findMany: mockProfileFindMany,
      findUnique: mockProfileFindUnique,
      count: mockProfileCount,
    },
    person: {
      findFirst: mockPersonFindFirst,
    },
  },
}))

import {
  getProgramProfiles,
  getProgramProfileById,
  getProgramProfilesByPersonId,
  findPersonByActiveContact,
  getProgramProfilesByFamilyId,
  getProgramProfilesWithBilling,
  searchProgramProfilesByNameOrContact,
  getProgramProfilesByStatus,
} from '../program-profile'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getProgramProfiles', () => {
  it('should use relationLoadStrategy join', async () => {
    mockProfileFindMany.mockResolvedValue([])
    mockProfileCount.mockResolvedValue(0)

    await getProgramProfiles({})

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getProgramProfileById', () => {
  it('should use relationLoadStrategy join', async () => {
    mockProfileFindUnique.mockResolvedValue(null)

    await getProgramProfileById('pp1')

    expect(mockProfileFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getProgramProfilesByPersonId', () => {
  it('should use relationLoadStrategy join', async () => {
    mockProfileFindMany.mockResolvedValue([])

    await getProgramProfilesByPersonId('p1')

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('findPersonByActiveContact', () => {
  it('should query by email on Person', async () => {
    mockPersonFindFirst.mockResolvedValue(null)

    await findPersonByActiveContact('test@example.com')

    const call = mockPersonFindFirst.mock.calls[0][0]
    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'test@example.com' }),
      ])
    )
  })

  it('should query by phone on Person', async () => {
    mockPersonFindFirst.mockResolvedValue(null)

    await findPersonByActiveContact(null, '6125551234')

    const call = mockPersonFindFirst.mock.calls[0][0]
    expect(call.where.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ phone: '6125551234' })])
    )
  })

  it('should return null when no email or phone provided', async () => {
    const result = await findPersonByActiveContact(null, null)

    expect(result).toBeNull()
    expect(mockPersonFindFirst).not.toHaveBeenCalled()
  })

  it('should return null when phone is invalid and no email', async () => {
    const result = await findPersonByActiveContact(null, '123')

    expect(result).toBeNull()
    expect(mockPersonFindFirst).not.toHaveBeenCalled()
  })

  it('should use relationLoadStrategy join', async () => {
    mockPersonFindFirst.mockResolvedValue(null)

    await findPersonByActiveContact('test@example.com')

    expect(mockPersonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getProgramProfiles - contact search', () => {
  it('should search by email/phone on Person', async () => {
    mockProfileFindMany.mockResolvedValue([])
    mockProfileCount.mockResolvedValue(0)

    await getProgramProfiles({ search: 'test@example.com' })

    const call = mockProfileFindMany.mock.calls[0][0]
    const personOR = call.where.person.OR
    expect(personOR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: expect.any(Object) }),
      ])
    )
  })
})

describe('getProgramProfilesByFamilyId', () => {
  it('should use relationLoadStrategy join', async () => {
    mockProfileFindMany.mockResolvedValue([])

    await getProgramProfilesByFamilyId('fam1')

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getProgramProfilesWithBilling', () => {
  it('should use relationLoadStrategy join', async () => {
    mockProfileFindMany.mockResolvedValue([])

    await getProgramProfilesWithBilling({})

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('searchProgramProfilesByNameOrContact', () => {
  it('should use relationLoadStrategy join', async () => {
    mockProfileFindMany.mockResolvedValue([])

    await searchProgramProfilesByNameOrContact('test')

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('should search by email/phone on Person', async () => {
    mockProfileFindMany.mockResolvedValue([])

    await searchProgramProfilesByNameOrContact('test@example.com')

    const call = mockProfileFindMany.mock.calls[0][0]
    const personOR = call.where.person.OR
    expect(personOR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: expect.any(Object) }),
      ])
    )
  })
})

describe('getProgramProfilesByStatus', () => {
  it('should use relationLoadStrategy join', async () => {
    mockProfileFindMany.mockResolvedValue([])

    await getProgramProfilesByStatus('ENROLLED')

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})
