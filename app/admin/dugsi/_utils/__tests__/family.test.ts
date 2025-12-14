/**
 * Family Utilities Tests
 *
 * Tests for family grouping and identification utilities
 */

import { describe, it, expect } from 'vitest'

import { DugsiRegistration } from '../../_types'
import { Family } from '../../_types'
import {
  getFamilyKey,
  groupRegistrationsByFamily,
  getFamilyStatus,
  getPrimaryPayerPhone,
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

describe('getPrimaryPayerPhone', () => {
  const createFamily = (
    overrides: Partial<DugsiRegistration> = {},
    familyOverrides: Partial<Family> = {}
  ): Family => ({
    familyKey: 'family-1',
    members: [
      {
        id: 'id-1',
        name: 'Child',
        gender: null,
        dateOfBirth: null,
        gradeLevel: null,
        shift: null,
        schoolName: null,
        healthInfo: null,
        createdAt: new Date(),
        parentFirstName: 'Parent1',
        parentLastName: 'Last',
        parentEmail: 'parent1@example.com',
        parentPhone: '5551111111',
        parent2FirstName: 'Parent2',
        parent2LastName: 'Last',
        parent2Email: 'parent2@example.com',
        parent2Phone: '5552222222',
        primaryPayerParentNumber: 1,
        paymentMethodCaptured: false,
        paymentMethodCapturedAt: null,
        stripeCustomerIdDugsi: null,
        stripeSubscriptionIdDugsi: null,
        paymentIntentIdDugsi: null,
        subscriptionStatus: null,
        subscriptionAmount: null,
        paidUntil: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        familyReferenceId: 'family-1',
        stripeAccountType: null,
        teacherName: null,
        teacherEmail: null,
        teacherPhone: null,
        morningTeacher: null,
        afternoonTeacher: null,
        hasTeacherAssigned: false,
        ...overrides,
      },
    ],
    hasPayment: false,
    hasSubscription: false,
    parentEmail: 'parent1@example.com',
    parentPhone: '5551111111',
    ...familyOverrides,
  })

  describe('when primaryPayerParentNumber is 1', () => {
    it('should return parentPhone', () => {
      const family = createFamily({ primaryPayerParentNumber: 1 })
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBe('5551111111')
      expect(result.usedFallback).toBe(false)
    })

    it('should fallback to parent2Phone when parentPhone is missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: 1,
        parentPhone: null,
      })
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBe('5552222222')
      expect(result.usedFallback).toBe(true)
      expect(result.fallbackReason).toBe('primary_payer_phone_missing')
    })

    it('should return null when both parent phones are missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: 1,
        parentPhone: null,
        parent2Phone: null,
      })
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBeNull()
      expect(result.usedFallback).toBe(true)
      expect(result.fallbackReason).toBe('primary_payer_phone_missing')
    })
  })

  describe('when primaryPayerParentNumber is 2', () => {
    it('should return parent2Phone', () => {
      const family = createFamily({ primaryPayerParentNumber: 2 })
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBe('5552222222')
      expect(result.usedFallback).toBe(false)
    })

    it('should fallback to parentPhone when parent2Phone is missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: 2,
        parent2Phone: null,
      })
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBe('5551111111')
      expect(result.usedFallback).toBe(true)
      expect(result.fallbackReason).toBe('primary_payer_phone_missing')
    })

    it('should return null when both parent phones are missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: 2,
        parentPhone: null,
        parent2Phone: null,
      })
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBeNull()
      expect(result.usedFallback).toBe(true)
      expect(result.fallbackReason).toBe('primary_payer_phone_missing')
    })
  })

  describe('when primaryPayerParentNumber is null', () => {
    it('should default to parentPhone', () => {
      const family = createFamily({ primaryPayerParentNumber: null })
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBe('5551111111')
      expect(result.usedFallback).toBe(true)
      expect(result.fallbackReason).toBe('primary_payer_not_set')
    })

    it('should fallback to parent2Phone when parentPhone is missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: null,
        parentPhone: null,
      })
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBe('5552222222')
      expect(result.usedFallback).toBe(true)
      expect(result.fallbackReason).toBe('primary_payer_not_set')
    })

    it('should return null when both parent phones are missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: null,
        parentPhone: null,
        parent2Phone: null,
      })
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBeNull()
      expect(result.usedFallback).toBe(true)
      expect(result.fallbackReason).toBe('primary_payer_not_set')
    })
  })

  describe('edge cases', () => {
    it('should handle empty members array by returning family.parentPhone', () => {
      const family: Family = {
        familyKey: 'family-1',
        members: [],
        hasPayment: false,
        hasSubscription: false,
        parentEmail: 'parent@example.com',
        parentPhone: '5553333333',
      }
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBe('5553333333')
      expect(result.usedFallback).toBe(true)
      expect(result.fallbackReason).toBe('primary_payer_not_set')
    })

    it('should return null when no phones are available', () => {
      const family = createFamily(
        {
          primaryPayerParentNumber: 1,
          parentPhone: null,
          parent2Phone: null,
        },
        { parentPhone: null }
      )
      const result = getPrimaryPayerPhone(family)
      expect(result.phone).toBeNull()
      expect(result.usedFallback).toBe(true)
    })
  })
})
