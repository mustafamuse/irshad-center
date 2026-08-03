import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'

import { reEnrollChild } from '../family-service'

const { mockGetProfile, mockUpdateStatusMany, mockCreateEnrollment, mockSync } =
  vi.hoisted(() => ({
    mockGetProfile: vi.fn(),
    mockUpdateStatusMany: vi.fn(),
    mockCreateEnrollment: vi.fn(),
    mockSync: vi.fn(),
  }))

vi.mock('@/lib/db/queries/program-profile', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getProgramProfileById: mockGetProfile,
  updateProgramProfileStatusMany: mockUpdateStatusMany,
}))

vi.mock('@/lib/db/queries/enrollment', () => ({
  createRegisteredEnrollment: mockCreateEnrollment,
}))

vi.mock('../billing-sync-service', () => ({
  syncFamilyBillingRate: mockSync,
}))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: (fn: (tx: string) => unknown) => fn('tx-client') },
}))

const WITHDRAWN_PROFILE = {
  id: 'p1',
  program: DUGSI_PROGRAM,
  status: 'WITHDRAWN',
  familyReferenceId: 'fam-1',
  person: { name: 'Aisha' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetProfile.mockResolvedValue(WITHDRAWN_PROFILE)
  mockUpdateStatusMany.mockResolvedValue({ count: 1 })
  mockSync.mockResolvedValue({ synced: true, rate: 16000, childCount: 2 })
})

describe('reEnrollChild', () => {
  it('flips status, creates a fresh enrollment, and syncs billing', async () => {
    const result = await reEnrollChild('p1')
    expect(mockUpdateStatusMany).toHaveBeenCalledWith(
      ['p1'],
      'REGISTERED',
      ['WITHDRAWN'],
      'tx-client'
    )
    expect(mockCreateEnrollment).toHaveBeenCalledWith(
      'p1',
      expect.any(Date),
      'tx-client'
    )
    expect(mockSync).toHaveBeenCalledWith('fam-1')
    expect(result.childId).toBe('p1')
    expect(result.warning).toBeUndefined()
  })

  it('rejects non-WITHDRAWN profiles', async () => {
    mockGetProfile.mockResolvedValueOnce({
      ...WITHDRAWN_PROFILE,
      status: 'ENROLLED',
    })
    await expect(reEnrollChild('p1')).rejects.toThrow(/not withdrawn/i)
    expect(mockUpdateStatusMany).not.toHaveBeenCalled()
  })

  it('rejects with 409 when the profile flips away from WITHDRAWN between the read and the transaction', async () => {
    mockUpdateStatusMany.mockResolvedValueOnce({ count: 0 })
    await expect(reEnrollChild('p1')).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(mockCreateEnrollment).not.toHaveBeenCalled()
  })

  it('rejects unknown or non-Dugsi profiles', async () => {
    mockGetProfile.mockResolvedValueOnce(null)
    await expect(reEnrollChild('p1')).rejects.toThrow()
  })

  it('keeps the roster change and returns a warning when sync fails', async () => {
    mockSync.mockRejectedValueOnce(new Error('stripe down'))
    const result = await reEnrollChild('p1')
    expect(result.childId).toBe('p1')
    expect(result.warning).toMatch(/billing/i)
  })

  it('propagates sync warnings (e.g. no subscription)', async () => {
    mockSync.mockResolvedValueOnce({
      synced: false,
      rate: 16000,
      childCount: 2,
      warning: 'No active subscription — family needs a new checkout',
    })
    const result = await reEnrollChild('p1')
    expect(result.warning).toMatch(/no active subscription/i)
  })
})
