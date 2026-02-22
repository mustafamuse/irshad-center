import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DugsiRegistration, Family } from '../../_types'
import { hasBillingMismatch } from '../billing'
import { filterFamiliesByTab } from '../filters'

vi.mock('../billing', () => ({
  hasBillingMismatch: vi.fn(),
}))

const mockedHasBillingMismatch = vi.mocked(hasBillingMismatch)

function createMember(
  overrides: Partial<DugsiRegistration> = {}
): DugsiRegistration {
  return {
    id: 'member-1',
    name: 'Child',
    status: 'ENROLLED',
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
    parentPhone: '5551111111',
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
  }
}

function createFamily(
  overrides: Partial<Family> = {},
  memberOverrides: Partial<DugsiRegistration>[] = [{}]
): Family {
  return {
    familyKey: 'family-1',
    members: memberOverrides.map((mo, i) =>
      createMember({ id: `member-${i + 1}`, ...mo })
    ),
    hasPayment: false,
    hasSubscription: false,
    hasChurned: false,
    parentEmail: 'parent@example.com',
    parentPhone: '5551111111',
    ...overrides,
  }
}

describe('filterFamiliesByTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('active tab', () => {
    it('should return families with hasSubscription: true', () => {
      const active = createFamily({ hasSubscription: true })
      const inactive = createFamily({
        familyKey: 'family-2',
        hasSubscription: false,
      })
      const result = filterFamiliesByTab([active, inactive], 'active')
      expect(result).toEqual([active])
    })
  })

  describe('churned tab', () => {
    it('should return families with hasChurned: true and hasSubscription: false', () => {
      const churned = createFamily({
        hasChurned: true,
        hasSubscription: false,
      })
      const activeChurned = createFamily({
        familyKey: 'family-2',
        hasChurned: true,
        hasSubscription: true,
      })
      const neither = createFamily({
        familyKey: 'family-3',
        hasChurned: false,
        hasSubscription: false,
      })
      const result = filterFamiliesByTab(
        [churned, activeChurned, neither],
        'churned'
      )
      expect(result).toEqual([churned])
    })
  })

  describe('needs-attention tab', () => {
    it('should return families with hasPayment: false and hasChurned: false', () => {
      const needsAttention = createFamily({
        hasPayment: false,
        hasChurned: false,
      })
      const hasPaid = createFamily({
        familyKey: 'family-2',
        hasPayment: true,
        hasChurned: false,
      })
      const churned = createFamily({
        familyKey: 'family-3',
        hasPayment: false,
        hasChurned: true,
      })
      const result = filterFamiliesByTab(
        [needsAttention, hasPaid, churned],
        'needs-attention'
      )
      expect(result).toEqual([needsAttention])
    })
  })

  describe('paused tab', () => {
    it('should return families with active members AND a member with subscriptionStatus paused', () => {
      const paused = createFamily({}, [
        { status: 'ENROLLED', subscriptionStatus: 'paused' },
      ])
      const notPaused = createFamily({ familyKey: 'family-2' }, [
        { status: 'ENROLLED', subscriptionStatus: 'active' },
      ])
      const result = filterFamiliesByTab([paused, notPaused], 'paused')
      expect(result).toEqual([paused])
    })

    it('should NOT include families where all members are WITHDRAWN even if subscriptionStatus is paused', () => {
      const withdrawnPaused = createFamily({}, [
        { status: 'WITHDRAWN', subscriptionStatus: 'paused' },
      ])
      const result = filterFamiliesByTab([withdrawnPaused], 'paused')
      expect(result).toEqual([])
    })
  })

  describe('inactive tab', () => {
    it('should return families with 0 active members and NOT churned', () => {
      const inactive = createFamily({ hasChurned: false }, [
        { status: 'WITHDRAWN' },
      ])
      const result = filterFamiliesByTab([inactive], 'inactive')
      expect(result).toEqual([inactive])
    })

    it('should NOT include churned families', () => {
      const churnedInactive = createFamily({ hasChurned: true }, [
        { status: 'WITHDRAWN' },
      ])
      const result = filterFamiliesByTab([churnedInactive], 'inactive')
      expect(result).toEqual([])
    })
  })

  describe('billing-mismatch tab', () => {
    it('should return families with subscription and a member with billing mismatch', () => {
      const member = createMember({ subscriptionAmount: 8000 })
      const mismatchFamily: Family = {
        familyKey: 'family-1',
        members: [member],
        hasPayment: true,
        hasSubscription: true,
        hasChurned: false,
        parentEmail: 'parent@example.com',
        parentPhone: '5551111111',
      }
      const noSubFamily = createFamily({
        familyKey: 'family-2',
        hasSubscription: false,
      })

      mockedHasBillingMismatch.mockImplementation((m) => m === member)

      const result = filterFamiliesByTab(
        [mismatchFamily, noSubFamily],
        'billing-mismatch'
      )
      expect(result).toEqual([mismatchFamily])
      expect(mockedHasBillingMismatch).toHaveBeenCalledWith(member)
    })
  })

  describe('all and overview tabs', () => {
    it('should return all families for "all" tab', () => {
      const families = [
        createFamily({ familyKey: 'family-1' }),
        createFamily({ familyKey: 'family-2' }),
      ]
      const result = filterFamiliesByTab(families, 'all')
      expect(result).toEqual(families)
    })

    it('should return all families for "overview" tab', () => {
      const families = [
        createFamily({ familyKey: 'family-1' }),
        createFamily({ familyKey: 'family-2' }),
      ]
      const result = filterFamiliesByTab(families, 'overview')
      expect(result).toEqual(families)
    })
  })
})
