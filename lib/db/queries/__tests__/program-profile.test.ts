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
  findPersonByContact,
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

describe('findPersonByContact', () => {
  it('should use relationLoadStrategy join', async () => {
    mockPersonFindFirst.mockResolvedValue(null)

    await findPersonByContact('test@example.com')

    expect(mockPersonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('findPersonByActiveContact', () => {
  it('should add isActive: true to email some clause', async () => {
    mockPersonFindFirst.mockResolvedValue(null)

    await findPersonByActiveContact('test@example.com')

    const call = mockPersonFindFirst.mock.calls[0][0]
    expect(call.where.OR[0].contactPoints.some).toMatchObject({
      type: 'EMAIL',
      isActive: true,
    })
  })

  it('should add isActive: true to phone some clause', async () => {
    mockPersonFindFirst.mockResolvedValue(null)

    await findPersonByActiveContact(null, '6125551234')

    const call = mockPersonFindFirst.mock.calls[0][0]
    expect(call.where.OR[0].contactPoints.some).toMatchObject({
      type: 'PHONE',
      isActive: true,
    })
  })

  it('should filter included contactPoints by isActive', async () => {
    mockPersonFindFirst.mockResolvedValue(null)

    await findPersonByActiveContact('test@example.com')

    const call = mockPersonFindFirst.mock.calls[0][0]
    expect(call.include.contactPoints).toEqual({
      where: { isActive: true },
    })
  })

  it('should return null when no email or phone provided', async () => {
    const result = await findPersonByActiveContact(null, null)

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

describe('getProgramProfiles - isActive filtering', () => {
  it('should add isActive: true to contact search some clause', async () => {
    mockProfileFindMany.mockResolvedValue([])
    mockProfileCount.mockResolvedValue(0)

    await getProgramProfiles({ search: 'test@example.com' })

    const call = mockProfileFindMany.mock.calls[0][0]
    const contactSearch = call.where.person.OR[1].contactPoints.some
    expect(contactSearch.isActive).toBe(true)
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
