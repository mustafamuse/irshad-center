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
