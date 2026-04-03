import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPersonFindMany, mockPersonUpdate } = vi.hoisted(() => ({
  mockPersonFindMany: vi.fn(),
  mockPersonUpdate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      findMany: mockPersonFindMany,
      update: mockPersonUpdate,
    },
  },
}))

import { getMultiRolePeople, updatePersonContact } from '../person'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getMultiRolePeople', () => {
  it('should use relationLoadStrategy join', async () => {
    mockPersonFindMany.mockResolvedValue([])

    await getMultiRolePeople()

    expect(mockPersonFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('updatePersonContact', () => {
  it('should update by personId', async () => {
    mockPersonUpdate.mockResolvedValue({})

    await updatePersonContact('p-1', { name: 'Alice' })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p-1' } })
    )
  })

  it('should pass data through unchanged', async () => {
    mockPersonUpdate.mockResolvedValue({})

    await updatePersonContact('p-1', { name: 'Alice' })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Alice' } })
    )
  })

  it('should pass null contact fields through unchanged', async () => {
    mockPersonUpdate.mockResolvedValue({})

    await updatePersonContact('p-1', { name: 'Alice', email: null })

    expect(mockPersonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Alice', email: null } })
    )
  })
})
