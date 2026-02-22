import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockProgramProfileFindMany } = vi.hoisted(() => ({
  mockProgramProfileFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findMany: (...args: unknown[]) => mockProgramProfileFindMany(...args),
    },
  },
}))

vi.mock('@/lib/constants/dugsi', () => ({
  DUGSI_PROGRAM: 'DUGSI_PROGRAM',
}))

import { getWithdrawFamilyPreview } from '../withdrawal-preview-service'

describe('getWithdrawFamilyPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return count and student list for active profiles', async () => {
    mockProgramProfileFindMany.mockResolvedValueOnce([
      { id: 's1', person: { name: 'Ali Hassan' } },
      { id: 's2', person: { name: 'Fatima Hassan' } },
    ])

    const result = await getWithdrawFamilyPreview('family-1')

    expect(result.count).toBe(2)
    expect(result.students).toEqual([
      { id: 's1', name: 'Ali Hassan' },
      { id: 's2', name: 'Fatima Hassan' },
    ])
  })

  it('should return empty list when no active profiles exist', async () => {
    mockProgramProfileFindMany.mockResolvedValueOnce([])

    const result = await getWithdrawFamilyPreview('family-1')

    expect(result.count).toBe(0)
    expect(result.students).toEqual([])
  })

  it('should filter by familyReferenceId and active statuses', async () => {
    mockProgramProfileFindMany.mockResolvedValueOnce([])

    await getWithdrawFamilyPreview('family-1')

    expect(mockProgramProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyReferenceId: 'family-1',
          program: 'DUGSI_PROGRAM',
          status: { in: ['REGISTERED', 'ENROLLED'] },
        },
        include: { person: { select: { name: true } } },
      })
    )
  })
})
