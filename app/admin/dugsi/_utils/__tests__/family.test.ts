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
  getActiveMembers,
  getActiveMemberCount,
  groupRegistrationsByFamily,
  getFamilyStatus,
  getPrimaryPayerPhone,
  getPrimaryPayerName,
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
      hasChurned: false,
      parentEmail: 'parent@example.com',
      parentPhone: '123-456-7890',
    }
    expect(getFamilyStatus(family)).toBe('active')
  })

  it('should return "churned" when family has churned subscription', () => {
    const family = {
      familyKey: 'family-1',
      members: [],
      hasPayment: true,
      hasSubscription: false,
      hasChurned: true,
      parentEmail: 'parent@example.com',
      parentPhone: '123-456-7890',
    }
    expect(getFamilyStatus(family)).toBe('churned')
  })

  it('should return "no-payment" when family has no payment', () => {
    const family = {
      familyKey: 'family-1',
      members: [],
      hasPayment: false,
      hasSubscription: false,
      hasChurned: false,
      parentEmail: 'parent@example.com',
      parentPhone: '123-456-7890',
    }
    expect(getFamilyStatus(family)).toBe('no-payment')
  })

  it('should prioritize subscription over churned', () => {
    const family = {
      familyKey: 'family-1',
      members: [],
      hasPayment: true,
      hasSubscription: true,
      hasChurned: true,
      parentEmail: 'parent@example.com',
      parentPhone: '123-456-7890',
    }
    expect(getFamilyStatus(family)).toBe('active')
  })

  it('should return "inactive" when all members are WITHDRAWN', () => {
    const family = {
      familyKey: 'family-1',
      members: [
        {
          id: 'id-1',
          name: 'Child 1',
          status: 'WITHDRAWN' as const,
          gender: null,
          dateOfBirth: null,
          gradeLevel: null,
          shift: null,
          schoolName: null,
          healthInfo: null,
          createdAt: new Date(),
          parentFirstName: 'Parent',
          parentLastName: 'Last',
          parentEmail: 'parent@example.com',
          parentPhone: '123',
          parent2FirstName: null,
          parent2LastName: null,
          parent2Email: null,
          parent2Phone: null,
          primaryPayerParentNumber: 1 as const,
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
          familyChildCount: 1,
        },
      ],
      hasPayment: true,
      hasSubscription: false,
      hasChurned: false,
      parentEmail: 'parent@example.com',
      parentPhone: '123',
    }
    expect(getFamilyStatus(family)).toBe('inactive')
  })

  it('should return "paused" when a member has subscriptionStatus: paused', () => {
    const family = {
      familyKey: 'family-1',
      members: [
        {
          id: 'id-1',
          name: 'Child 1',
          status: 'ENROLLED' as const,
          gender: null,
          dateOfBirth: null,
          gradeLevel: null,
          shift: null,
          schoolName: null,
          healthInfo: null,
          createdAt: new Date(),
          parentFirstName: 'Parent',
          parentLastName: 'Last',
          parentEmail: 'parent@example.com',
          parentPhone: '123',
          parent2FirstName: null,
          parent2LastName: null,
          parent2Email: null,
          parent2Phone: null,
          primaryPayerParentNumber: 1 as const,
          paymentMethodCaptured: true,
          paymentMethodCapturedAt: null,
          stripeCustomerIdDugsi: 'cus_123',
          stripeSubscriptionIdDugsi: 'sub_123',
          paymentIntentIdDugsi: null,
          subscriptionStatus: 'paused' as const,
          subscriptionAmount: 8000,
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
          familyChildCount: 1,
        },
      ],
      hasPayment: true,
      hasSubscription: true,
      hasChurned: false,
      parentEmail: 'parent@example.com',
      parentPhone: '123',
    }
    expect(getFamilyStatus(family)).toBe('paused')
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

  it('should mark family as churned when subscription is canceled', () => {
    const registrations: Partial<DugsiRegistration>[] = [
      {
        id: 'id-1',
        parentEmail: 'parent@example.com',
        stripeSubscriptionIdDugsi: 'sub_123',
        subscriptionStatus: 'canceled',
        paymentMethodCaptured: true,
        createdAt: new Date('2024-01-01'),
      },
    ]
    const families = groupRegistrationsByFamily(
      registrations as DugsiRegistration[]
    )
    expect(families[0].hasChurned).toBe(true)
    expect(families[0].hasSubscription).toBe(false)
  })

  it('should not mark family as churned when subscription is active', () => {
    const registrations: Partial<DugsiRegistration>[] = [
      {
        id: 'id-1',
        parentEmail: 'parent@example.com',
        stripeSubscriptionIdDugsi: 'sub_123',
        subscriptionStatus: 'active',
        paymentMethodCaptured: true,
        createdAt: new Date('2024-01-01'),
      },
    ]
    const families = groupRegistrationsByFamily(
      registrations as DugsiRegistration[]
    )
    expect(families[0].hasChurned).toBe(false)
    expect(families[0].hasSubscription).toBe(true)
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
        status: 'REGISTERED',
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
        familyChildCount: 1,
        ...overrides,
      },
    ],
    hasPayment: false,
    hasSubscription: false,
    hasChurned: false,
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
        hasChurned: false,
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

describe('getPrimaryPayerName', () => {
  const createFamily = (
    overrides: Partial<DugsiRegistration> = {},
    familyOverrides: Partial<Family> = {}
  ): Family => ({
    familyKey: 'family-1',
    members: [
      {
        id: 'id-1',
        name: 'Child',
        status: 'REGISTERED',
        gender: null,
        dateOfBirth: null,
        gradeLevel: null,
        shift: null,
        schoolName: null,
        healthInfo: null,
        createdAt: new Date(),
        parentFirstName: 'Parent1First',
        parentLastName: 'Parent1Last',
        parentEmail: 'parent1@example.com',
        parentPhone: '5551111111',
        parent2FirstName: 'Parent2First',
        parent2LastName: 'Parent2Last',
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
        familyChildCount: 1,
        ...overrides,
      },
    ],
    hasPayment: false,
    hasSubscription: false,
    hasChurned: false,
    parentEmail: 'parent1@example.com',
    parentPhone: '5551111111',
    ...familyOverrides,
  })

  describe('when primaryPayerParentNumber is 1', () => {
    it('should return parent1 full name', () => {
      const family = createFamily({ primaryPayerParentNumber: 1 })
      const result = getPrimaryPayerName(family)
      expect(result).toBe('Parent1First Parent1Last')
    })

    it('should return only first name if last name is missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: 1,
        parentLastName: null,
      })
      const result = getPrimaryPayerName(family)
      expect(result).toBe('Parent1First')
    })

    it('should return only last name if first name is missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: 1,
        parentFirstName: null,
      })
      const result = getPrimaryPayerName(family)
      expect(result).toBe('Parent1Last')
    })
  })

  describe('when primaryPayerParentNumber is 2', () => {
    it('should return parent2 full name', () => {
      const family = createFamily({ primaryPayerParentNumber: 2 })
      const result = getPrimaryPayerName(family)
      expect(result).toBe('Parent2First Parent2Last')
    })

    it('should return only first name if last name is missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: 2,
        parent2LastName: null,
      })
      const result = getPrimaryPayerName(family)
      expect(result).toBe('Parent2First')
    })

    it('should fall back to parent1 if parent2 names are missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: 2,
        parent2FirstName: null,
        parent2LastName: null,
      })
      const result = getPrimaryPayerName(family)
      expect(result).toBe('Parent1First Parent1Last')
    })
  })

  describe('when primaryPayerParentNumber is null', () => {
    it('should default to parent1 name', () => {
      const family = createFamily({ primaryPayerParentNumber: null })
      const result = getPrimaryPayerName(family)
      expect(result).toBe('Parent1First Parent1Last')
    })
  })

  describe('edge cases', () => {
    it('should return "Parent" fallback when no members', () => {
      const family: Family = {
        familyKey: 'family-1',
        members: [],
        hasPayment: false,
        hasSubscription: false,
        hasChurned: false,
        parentEmail: 'parent@example.com',
        parentPhone: '5553333333',
      }
      const result = getPrimaryPayerName(family)
      expect(result).toBe('Parent')
    })

    it('should return "Parent" fallback when all names are missing', () => {
      const family = createFamily({
        primaryPayerParentNumber: 1,
        parentFirstName: null,
        parentLastName: null,
      })
      const result = getPrimaryPayerName(family)
      expect(result).toBe('Parent')
    })
  })
})

describe('getActiveMembers', () => {
  const makeMember = (
    overrides: Partial<DugsiRegistration> = {}
  ): DugsiRegistration =>
    ({
      id: 'id-1',
      name: 'Child',
      status: 'ENROLLED',
      gender: null,
      dateOfBirth: null,
      gradeLevel: null,
      shift: null,
      schoolName: null,
      healthInfo: null,
      createdAt: new Date(),
      parentFirstName: 'P',
      parentLastName: 'L',
      parentEmail: 'p@e.com',
      parentPhone: '555',
      parent2FirstName: null,
      parent2LastName: null,
      parent2Email: null,
      parent2Phone: null,
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
      familyChildCount: 1,
      ...overrides,
    }) as DugsiRegistration

  const makeFamily = (members: DugsiRegistration[]): Family => ({
    familyKey: 'family-1',
    members,
    hasPayment: false,
    hasSubscription: false,
    hasChurned: false,
    parentEmail: 'p@e.com',
    parentPhone: '555',
  })

  it('should return only ENROLLED and REGISTERED members', () => {
    const family = makeFamily([
      makeMember({ id: '1', status: 'ENROLLED' as const }),
      makeMember({ id: '2', status: 'REGISTERED' as const }),
      makeMember({ id: '3', status: 'WITHDRAWN' as const }),
    ])
    const active = getActiveMembers(family)
    expect(active).toHaveLength(2)
    expect(active.map((m) => m.id)).toEqual(['1', '2'])
  })

  it('should exclude WITHDRAWN members', () => {
    const family = makeFamily([
      makeMember({ id: '1', status: 'WITHDRAWN' as const }),
      makeMember({ id: '2', status: 'WITHDRAWN' as const }),
    ])
    expect(getActiveMembers(family)).toHaveLength(0)
  })

  it('should return empty array when all members are WITHDRAWN', () => {
    const family = makeFamily([makeMember({ status: 'WITHDRAWN' as const })])
    expect(getActiveMembers(family)).toEqual([])
  })

  it('should return all members when all are active', () => {
    const family = makeFamily([
      makeMember({ id: '1', status: 'ENROLLED' as const }),
      makeMember({ id: '2', status: 'REGISTERED' as const }),
    ])
    expect(getActiveMembers(family)).toHaveLength(2)
  })
})

describe('getActiveMemberCount', () => {
  const makeMember = (
    overrides: Partial<DugsiRegistration> = {}
  ): DugsiRegistration =>
    ({
      id: 'id-1',
      name: 'Child',
      status: 'ENROLLED',
      gender: null,
      dateOfBirth: null,
      gradeLevel: null,
      shift: null,
      schoolName: null,
      healthInfo: null,
      createdAt: new Date(),
      parentFirstName: 'P',
      parentLastName: 'L',
      parentEmail: 'p@e.com',
      parentPhone: '555',
      parent2FirstName: null,
      parent2LastName: null,
      parent2Email: null,
      parent2Phone: null,
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
      familyChildCount: 1,
      ...overrides,
    }) as DugsiRegistration

  const makeFamily = (members: DugsiRegistration[]): Family => ({
    familyKey: 'family-1',
    members,
    hasPayment: false,
    hasSubscription: false,
    hasChurned: false,
    parentEmail: 'p@e.com',
    parentPhone: '555',
  })

  it('should return count matching getActiveMembers length', () => {
    const family = makeFamily([
      makeMember({ id: '1', status: 'ENROLLED' as const }),
      makeMember({ id: '2', status: 'WITHDRAWN' as const }),
      makeMember({ id: '3', status: 'REGISTERED' as const }),
    ])
    expect(getActiveMemberCount(family)).toBe(2)
    expect(getActiveMemberCount(family)).toBe(getActiveMembers(family).length)
  })

  it('should return 0 for all-withdrawn family', () => {
    const family = makeFamily([
      makeMember({ status: 'WITHDRAWN' as const }),
      makeMember({ status: 'WITHDRAWN' as const }),
    ])
    expect(getActiveMemberCount(family)).toBe(0)
  })
})
