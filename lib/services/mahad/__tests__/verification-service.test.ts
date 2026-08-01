import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockFindById,
  mockFindByEmail,
  mockFindByDob,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindByEmail: vi.fn(),
  mockFindByDob: vi.fn(),
}))

vi.mock('@/lib/db/queries/mahad-verification', () => ({
  findMahadProfileById: (...args: unknown[]) => mockFindById(...args),
  findMahadProfileByEmail: (...args: unknown[]) => mockFindByEmail(...args),
  findMahadProfilesByDob: (...args: unknown[]) => mockFindByDob(...args),
}))

import {
  deriveStatus,
  lookupByEmail,
  lookupByNameAndDob,
  lookupByProfileId,
} from '../verification-service'

const baseCandidate = {
  profileId: 'profile-1',
  fullName: 'Mohamed Ali',
  registeredAt: new Date('2026-01-15T08:30:00.000Z'),
  enrollmentStatus: 'REGISTERED' as const,
  hasStripeCustomer: false,
  subscriptionStatus: null,
}

describe('deriveStatus', () => {
  it('returns awaiting_payment_link when REGISTERED with no Stripe customer', () => {
    const view = deriveStatus({
      enrollmentStatus: 'REGISTERED',
      hasStripeCustomer: false,
      subscriptionStatus: null,
    })
    expect(view.kind).toBe('awaiting_payment_link')
    expect(view.guidance).toBe('check_whatsapp')
  })

  it('returns payment_link_sent when Stripe customer exists but no active subscription', () => {
    const view = deriveStatus({
      enrollmentStatus: 'REGISTERED',
      hasStripeCustomer: true,
      subscriptionStatus: null,
    })
    expect(view.kind).toBe('payment_link_sent')
    expect(view.guidance).toBe('check_whatsapp')
  })

  it('returns payment_link_sent when subscription is incomplete', () => {
    const view = deriveStatus({
      enrollmentStatus: 'REGISTERED',
      hasStripeCustomer: true,
      subscriptionStatus: 'incomplete',
    })
    expect(view.kind).toBe('payment_link_sent')
  })

  it('returns payment_link_sent when subscription is past_due', () => {
    const view = deriveStatus({
      enrollmentStatus: 'ENROLLED',
      hasStripeCustomer: true,
      subscriptionStatus: 'past_due',
    })
    expect(view.kind).toBe('payment_link_sent')
  })

  it('returns payment_confirmed when subscription is active', () => {
    const view = deriveStatus({
      enrollmentStatus: 'REGISTERED',
      hasStripeCustomer: true,
      subscriptionStatus: 'active',
    })
    expect(view.kind).toBe('payment_confirmed')
    expect(view.guidance).toBe('none')
  })

  it.each([
    ['WITHDRAWN', 'withdrawn'],
    ['ON_LEAVE', 'on_leave'],
    ['COMPLETED', 'completed'],
    ['SUSPENDED', 'suspended'],
  ] as const)(
    'maps EnrollmentStatus %s to kind %s regardless of payment state',
    (enrollmentStatus, kind) => {
      const view = deriveStatus({
        enrollmentStatus,
        hasStripeCustomer: true,
        subscriptionStatus: 'active',
      })
      expect(view.kind).toBe(kind)
    }
  )

  it('every view has non-empty label and detail copy', () => {
    const inputs = [
      ['REGISTERED', false, null],
      ['REGISTERED', true, null],
      ['REGISTERED', true, 'active'],
      ['ON_LEAVE', false, null],
      ['WITHDRAWN', false, null],
      ['COMPLETED', false, null],
      ['SUSPENDED', false, null],
    ] as const
    for (const [enrollmentStatus, hasStripeCustomer, subscriptionStatus] of inputs) {
      const view = deriveStatus({
        enrollmentStatus,
        hasStripeCustomer,
        subscriptionStatus,
      })
      expect(view.label.length).toBeGreaterThan(0)
      expect(view.detail.length).toBeGreaterThan(0)
    }
  })
})

describe('lookupByProfileId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { found: false } when query returns null', async () => {
    mockFindById.mockResolvedValue(null)
    const result = await lookupByProfileId('missing-id')
    expect(result).toEqual({ found: false })
  })

  it('returns full result when query finds a profile', async () => {
    mockFindById.mockResolvedValue(baseCandidate)
    const result = await lookupByProfileId('profile-1')
    expect(result).toEqual({
      found: true,
      profileId: 'profile-1',
      firstName: 'Mohamed',
      registeredAt: '2026-01-15',
      status: expect.objectContaining({ kind: 'awaiting_payment_link' }),
    })
  })

  it('does not leak fullName onto the result', async () => {
    mockFindById.mockResolvedValue(baseCandidate)
    const result = (await lookupByProfileId('profile-1')) as Record<
      string,
      unknown
    >
    expect(result.fullName).toBeUndefined()
  })
})

describe('lookupByEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lowercases and trims the email before querying', async () => {
    mockFindByEmail.mockResolvedValue(baseCandidate)
    await lookupByEmail('  Mohamed@TEST.com  ')
    expect(mockFindByEmail).toHaveBeenCalledWith('mohamed@test.com')
  })

  it('returns { found: false } for empty input', async () => {
    const result = await lookupByEmail('   ')
    expect(result).toEqual({ found: false })
    expect(mockFindByEmail).not.toHaveBeenCalled()
  })

  it('maps a found candidate to a public-safe result', async () => {
    mockFindByEmail.mockResolvedValue(baseCandidate)
    const result = await lookupByEmail('mohamed@test.com')
    expect(result).toMatchObject({
      found: true,
      profileId: 'profile-1',
      firstName: 'Mohamed',
    })
  })
})

describe('lookupByNameAndDob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not-found when no candidates match the DOB', async () => {
    mockFindByDob.mockResolvedValue([])
    const result = await lookupByNameAndDob({
      firstName: 'Mohammed',
      lastName: 'Ali',
      dateOfBirth: new Date('2005-03-15'),
    })
    expect(result).toEqual({ found: false })
  })

  it('matches alias spellings (Muhammad <-> Mohammed)', async () => {
    mockFindByDob.mockResolvedValue([
      { ...baseCandidate, fullName: 'Mohammed Ali' },
    ])
    const result = await lookupByNameAndDob({
      firstName: 'Muhammad',
      lastName: 'Ali',
      dateOfBirth: new Date('2005-03-15'),
    })
    expect(result.found).toBe(true)
  })

  it('matches names with diacritics', async () => {
    mockFindByDob.mockResolvedValue([
      { ...baseCandidate, fullName: 'Mohamed Ali' },
    ])
    const result = await lookupByNameAndDob({
      firstName: 'Móhamméd',
      lastName: 'Ali',
      dateOfBirth: new Date('2005-03-15'),
    })
    expect(result.found).toBe(true)
  })

  it('matches first/last tokens when stored name has middle name', async () => {
    mockFindByDob.mockResolvedValue([
      { ...baseCandidate, fullName: 'Mohammed Nur Hassan' },
    ])
    const result = await lookupByNameAndDob({
      firstName: 'Mohammed',
      lastName: 'Hassan',
      dateOfBirth: new Date('2005-03-15'),
    })
    expect(result.found).toBe(true)
  })

  it('returns not-found when multiple candidates collide on normalized name', async () => {
    mockFindByDob.mockResolvedValue([
      { ...baseCandidate, profileId: 'p-a', fullName: 'Mohammed Ali' },
      { ...baseCandidate, profileId: 'p-b', fullName: 'Muhammad Ali' },
    ])
    const result = await lookupByNameAndDob({
      firstName: 'Mohammed',
      lastName: 'Ali',
      dateOfBirth: new Date('2005-03-15'),
    })
    expect(result).toEqual({ found: false })
  })

  it('disambiguates siblings with same DOB by name', async () => {
    mockFindByDob.mockResolvedValue([
      { ...baseCandidate, profileId: 'p-a', fullName: 'Aisha Hassan' },
      { ...baseCandidate, profileId: 'p-b', fullName: 'Abdi Hassan' },
    ])
    const result = await lookupByNameAndDob({
      firstName: 'Abdi',
      lastName: 'Hassan',
      dateOfBirth: new Date('2010-03-15'),
    })
    expect(result).toMatchObject({ found: true, profileId: 'p-b' })
  })

  it('returns not-found when input is missing tokens', async () => {
    mockFindByDob.mockResolvedValue([baseCandidate])
    const result = await lookupByNameAndDob({
      firstName: '',
      lastName: 'Ali',
      dateOfBirth: new Date('2005-03-15'),
    })
    expect(result).toEqual({ found: false })
  })

  it('does not match when stored fullName is a single token', async () => {
    mockFindByDob.mockResolvedValue([{ ...baseCandidate, fullName: 'Mohammed' }])
    const result = await lookupByNameAndDob({
      firstName: 'Mohammed',
      lastName: 'Mohammed',
      dateOfBirth: new Date('2005-03-15'),
    })
    expect(result).toEqual({ found: false })
  })
})
