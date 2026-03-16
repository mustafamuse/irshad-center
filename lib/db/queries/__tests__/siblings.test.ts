import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockSiblingFindMany, mockPersonFindUnique, mockProfileFindMany } =
  vi.hoisted(() => ({
    mockSiblingFindMany: vi.fn(),
    mockPersonFindUnique: vi.fn(),
    mockProfileFindMany: vi.fn(),
  }))

vi.mock('@/lib/db', () => ({
  prisma: {
    siblingRelationship: {
      findMany: mockSiblingFindMany,
    },
    person: {
      findUnique: mockPersonFindUnique,
    },
    programProfile: {
      findMany: mockProfileFindMany,
    },
  },
}))

import {
  getPersonSiblings,
  getSiblingDetails,
  getSiblingGroupsByProgram,
  getSiblingsByFamilyId,
} from '../siblings'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getPersonSiblings', () => {
  it('should use relationLoadStrategy join', async () => {
    mockSiblingFindMany.mockResolvedValue([])

    await getPersonSiblings('p1')

    expect(mockSiblingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getSiblingDetails', () => {
  it('should use relationLoadStrategy join on person.findUnique', async () => {
    mockPersonFindUnique.mockResolvedValue({ id: 'p1', programProfiles: [] })
    mockSiblingFindMany.mockResolvedValue([])

    await getSiblingDetails('p1')

    expect(mockPersonFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getSiblingGroupsByProgram', () => {
  it('should use relationLoadStrategy join', async () => {
    mockSiblingFindMany.mockResolvedValue([])

    await getSiblingGroupsByProgram()

    expect(mockSiblingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getSiblingsByFamilyId', () => {
  it('should use relationLoadStrategy join on programProfile.findMany', async () => {
    mockProfileFindMany.mockResolvedValue([{ personId: 'p1' }])
    mockSiblingFindMany.mockResolvedValue([])

    await getSiblingsByFamilyId('fam1')

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })

  it('should use relationLoadStrategy join on siblingRelationship.findMany', async () => {
    mockProfileFindMany.mockResolvedValue([{ personId: 'p1' }])
    mockSiblingFindMany.mockResolvedValue([])

    await getSiblingsByFamilyId('fam1')

    expect(mockSiblingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})
