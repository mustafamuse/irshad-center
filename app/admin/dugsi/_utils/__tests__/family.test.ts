/**
 * Family Utilities Tests
 *
 * Tests for family grouping and identification utilities
 */

import { describe, it, expect } from 'vitest'

import { DugsiRegistration } from '../../_types'
import {
  getFamilyKey,
  groupRegistrationsByFamily,
  getFamilyStatus,
} from '../family'

describe('getFamilyKey', () => {
  it('should return familyReferenceId when present', () => {
    const registration: Partial<DugsiRegistration> = {
      id: 'id-1',
      familyReferenceId: 'family-ref-123',
      parentEmail: 'parent@example.com',
    }
    expect(getFamilyKey(registration as DugsiRegistration)).toBe(
      'family-ref-123'
    )
  })

  it('should return parentEmail when familyReferenceId is missing', () => {
    const registration: Partial<DugsiRegistration> = {
      id: 'id-1',
      parentEmail: 'parent@example.com',
    }
    expect(getFamilyKey(registration as DugsiRegistration)).toBe(
      'parent@example.com'
    )
  })

  it('should return id when both familyReferenceId and parentEmail are missing', () => {
    const registration: Partial<DugsiRegistration> = {
      id: 'id-1',
    }
    expect(getFamilyKey(registration as DugsiRegistration)).toBe('id-1')
  })

  it('should prioritize familyReferenceId over parentEmail', () => {
    const registration: Partial<DugsiRegistration> = {
      id: 'id-1',
      familyReferenceId: 'family-ref-123',
      parentEmail: 'parent@example.com',
    }
    const key = getFamilyKey(registration as DugsiRegistration)
    expect(key).toBe('family-ref-123')
    expect(key).not.toBe('parent@example.com')
  })
})

describe('getFamilyStatus', () => {
  it('should return "active" when family has subscription', () => {
    const family = {
      familyKey: 'family-1',
      members: [],
      hasPayment: true,
      hasSubscription: true,
      parentEmail: 'parent@example.com',
      parentPhone: '123-456-7890',
    }
    expect(getFamilyStatus(family)).toBe('active')
  })

  it('should return "pending" when family has payment but no subscription', () => {
    const family = {
      familyKey: 'family-1',
      members: [],
      hasPayment: true,
      hasSubscription: false,
      parentEmail: 'parent@example.com',
      parentPhone: '123-456-7890',
    }
    expect(getFamilyStatus(family)).toBe('pending')
  })

  it('should return "no-payment" when family has no payment', () => {
    const family = {
      familyKey: 'family-1',
      members: [],
      hasPayment: false,
      hasSubscription: false,
      parentEmail: 'parent@example.com',
      parentPhone: '123-456-7890',
    }
    expect(getFamilyStatus(family)).toBe('no-payment')
  })

  it('should prioritize subscription over payment', () => {
    const family = {
      familyKey: 'family-1',
      members: [],
      hasPayment: true,
      hasSubscription: true,
      parentEmail: 'parent@example.com',
      parentPhone: '123-456-7890',
    }
    expect(getFamilyStatus(family)).toBe('active')
  })
})

describe('groupRegistrationsByFamily', () => {
  it('should group registrations by familyReferenceId', () => {
    const registrations: Partial<DugsiRegistration>[] = [
      {
        id: 'id-1',
        familyReferenceId: 'family-1',
        parentEmail: 'parent@example.com',
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'id-2',
        familyReferenceId: 'family-1',
        parentEmail: 'parent@example.com',
        createdAt: new Date('2024-01-02'),
      },
    ]
    const families = groupRegistrationsByFamily(
      registrations as DugsiRegistration[]
    )
    expect(families).toHaveLength(1)
    expect(families[0].members).toHaveLength(2)
    expect(families[0].familyKey).toBe('family-1')
  })

  it('should group registrations by parentEmail when familyReferenceId is missing', () => {
    const registrations: Partial<DugsiRegistration>[] = [
      {
        id: 'id-1',
        parentEmail: 'parent@example.com',
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'id-2',
        parentEmail: 'parent@example.com',
        createdAt: new Date('2024-01-02'),
      },
    ]
    const families = groupRegistrationsByFamily(
      registrations as DugsiRegistration[]
    )
    expect(families).toHaveLength(1)
    expect(families[0].familyKey).toBe('parent@example.com')
  })

  it('should create separate families for different emails', () => {
    const registrations: Partial<DugsiRegistration>[] = [
      {
        id: 'id-1',
        parentEmail: 'parent1@example.com',
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'id-2',
        parentEmail: 'parent2@example.com',
        createdAt: new Date('2024-01-02'),
      },
    ]
    const families = groupRegistrationsByFamily(
      registrations as DugsiRegistration[]
    )
    expect(families).toHaveLength(2)
  })

  it('should sort members by creation date (oldest first)', () => {
    const registrations: Partial<DugsiRegistration>[] = [
      {
        id: 'id-2',
        parentEmail: 'parent@example.com',
        createdAt: new Date('2024-01-02'),
      },
      {
        id: 'id-1',
        parentEmail: 'parent@example.com',
        createdAt: new Date('2024-01-01'),
      },
    ]
    const families = groupRegistrationsByFamily(
      registrations as DugsiRegistration[]
    )
    expect(families[0].members[0].id).toBe('id-1')
    expect(families[0].members[1].id).toBe('id-2')
  })

  it('should mark family as having payment when any member has payment', () => {
    const registrations: Partial<DugsiRegistration>[] = [
      {
        id: 'id-1',
        parentEmail: 'parent@example.com',
        paymentMethodCaptured: false,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'id-2',
        parentEmail: 'parent@example.com',
        paymentMethodCaptured: true,
        createdAt: new Date('2024-01-02'),
      },
    ]
    const families = groupRegistrationsByFamily(
      registrations as DugsiRegistration[]
    )
    expect(families[0].hasPayment).toBe(true)
  })

  it('should mark family as having subscription when any member has active subscription', () => {
    const registrations: Partial<DugsiRegistration>[] = [
      {
        id: 'id-1',
        parentEmail: 'parent@example.com',
        stripeSubscriptionIdDugsi: 'sub_123',
        subscriptionStatus: 'active',
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'id-2',
        parentEmail: 'parent@example.com',
        stripeSubscriptionIdDugsi: null,
        subscriptionStatus: null,
        createdAt: new Date('2024-01-02'),
      },
    ]
    const families = groupRegistrationsByFamily(
      registrations as DugsiRegistration[]
    )
    expect(families[0].hasSubscription).toBe(true)
  })

  it('should not mark family as having subscription for inactive subscriptions', () => {
    const registrations: Partial<DugsiRegistration>[] = [
      {
        id: 'id-1',
        parentEmail: 'parent@example.com',
        stripeSubscriptionIdDugsi: 'sub_123',
        subscriptionStatus: 'canceled',
        createdAt: new Date('2024-01-01'),
      },
    ]
    const families = groupRegistrationsByFamily(
      registrations as DugsiRegistration[]
    )
    expect(families[0].hasSubscription).toBe(false)
  })

  it('should use first member for parentEmail and parentPhone', () => {
    const registrations: Partial<DugsiRegistration>[] = [
      {
        id: 'id-1',
        parentEmail: 'parent@example.com',
        parentPhone: '123-456-7890',
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'id-2',
        parentEmail: 'different@example.com',
        parentPhone: '987-654-3210',
        createdAt: new Date('2024-01-02'),
      },
    ]
    const families = groupRegistrationsByFamily(
      registrations as DugsiRegistration[]
    )
    // Should create separate families
    expect(families).toHaveLength(2)
    expect(families[0].parentEmail).toBe('parent@example.com')
    expect(families[0].parentPhone).toBe('123-456-7890')
  })

  it('should handle empty registrations array', () => {
    const families = groupRegistrationsByFamily([])
    expect(families).toEqual([])
  })
})
