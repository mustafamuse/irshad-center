import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPersonFindMany } = vi.hoisted(() => ({
  mockPersonFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      findMany: mockPersonFindMany,
    },
  },
}))

import { getMultiRolePeople } from '../person'

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
