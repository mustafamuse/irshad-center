import { SubscriptionStatus } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import { createAdminActionClientMock } from '../../_test-utils/admin-action-client-mock'

const { mockGetAllDugsiRegistrations, mockLoggerInfo } = vi.hoisted(() => ({
  mockGetAllDugsiRegistrations: vi.fn(),
  mockLoggerInfo: vi.fn(),
}))

vi.mock('@/lib/safe-action', () => ({
  adminActionClient: createAdminActionClientMock(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/services/dugsi', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/services/dugsi')>()
  return {
    ...original,
    getAllDugsiRegistrations: (...args: unknown[]) =>
      mockGetAllDugsiRegistrations(...args),
  }
})

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
}))

import { DugsiRegistration } from '../_types'
import { generateDugsiVCardContent } from '../actions'

function makeReg(
  overrides: Partial<DugsiRegistration> = {}
): DugsiRegistration {
  return {
    id: 'reg-1',
    name: 'Child One',
    gender: null,
    dateOfBirth: null,
    gradeLevel: null,
    shift: null,
    schoolName: null,
    healthInfo: null,
    createdAt: new Date('2024-01-01'),
    parentFirstName: 'Ahmed',
    parentLastName: 'Hassan',
    parentEmail: 'ahmed@example.com',
    parentPhone: '6125551234',
    parent2FirstName: null,
    parent2LastName: null,
    parent2Email: null,
    parent2Phone: null,
    primaryPayerParentNumber: 1,
    paymentMethodCaptured: true,
    paymentMethodCapturedAt: null,
    stripeCustomerIdDugsi: 'cus_1',
    stripeSubscriptionIdDugsi: 'sub_1',
    paymentIntentIdDugsi: null,
    subscriptionStatus: SubscriptionStatus.active,
    subscriptionAmount: 5000,
    paidUntil: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    familyReferenceId: 'fam-1',
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

function vcardCount(content: string): number {
  return (content.match(/BEGIN:VCARD/g) ?? []).length
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateDugsiVCardContent', () => {
  it('groups two registrations with differently-formatted parent phones into one family', async () => {
    const reg1 = makeReg({
      id: 'reg-1',
      name: 'Child One',
      familyReferenceId: null,
      parentEmail: null,
      parentPhone: '(612) 555-1234',
    })
    const reg2 = makeReg({
      id: 'reg-2',
      name: 'Child Two',
      familyReferenceId: null,
      parentEmail: null,
      parentPhone: '6125551234',
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg1, reg2])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    const content = result?.data?.content ?? ''
    expect(vcardCount(content)).toBe(1)
    expect(content).toContain('Child One')
    expect(content).toContain('Child Two')
  })

  it('same parent across two families produces one vCard with merged children in NOTE', async () => {
    const reg1 = makeReg({
      id: 'reg-1',
      name: 'Child Alpha',
      familyReferenceId: 'fam-A',
      parentEmail: 'SHARED@example.com',
      parentPhone: null,
    })
    const reg2 = makeReg({
      id: 'reg-2',
      name: 'Child Beta',
      familyReferenceId: 'fam-B',
      parentEmail: 'shared@example.com',
      parentPhone: null,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg1, reg2])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    expect(result?.data?.skippedDuplicate).toBe(1)
    const note = result?.data?.content ?? ''
    expect(vcardCount(note)).toBe(1)
    expect(note).toMatch(/NOTE:Children: .*Child Alpha.*Child Beta/)
  })

  it('parent2 with phone but no name is exported with "Dugsi Parent" fallback', async () => {
    const reg = makeReg({
      id: 'reg-1',
      name: 'Child One',
      parentEmail: 'parent1@example.com',
      parentPhone: null,
      parent2FirstName: null,
      parent2LastName: null,
      parent2Email: null,
      parent2Phone: '6125559999',
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(2)
    const content = result?.data?.content ?? ''
    expect(content).toContain('FN:Ahmed Hassan')
    expect(content).toContain('FN:Dugsi Parent')
    expect((content.match(/FN:Dugsi Parent/g) ?? []).length).toBe(1)
  })

  it('parent1 with no name but with contact info is exported with "Dugsi Parent" fallback', async () => {
    const reg = makeReg({
      id: 'reg-1',
      name: 'Child One',
      parentFirstName: null,
      parentLastName: null,
      parentEmail: 'noname@example.com',
      parentPhone: null,
      parent2FirstName: null,
      parent2LastName: null,
      parent2Email: null,
      parent2Phone: null,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    expect(result?.data?.content).toContain('FN:Dugsi Parent')
    expect(result?.data?.skippedNoContact).toBe(0)
  })

  it('returns split skip counts: no-contact bucket and duplicate bucket', async () => {
    const reg1 = makeReg({
      id: 'reg-1',
      name: 'Child One',
      familyReferenceId: 'fam-1',
      parentFirstName: 'Ahmed',
      parentLastName: 'Hassan',
      parentEmail: null,
      parentPhone: null,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg1])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.skippedNoContact).toBeGreaterThanOrEqual(1)
    expect(result?.data?.skippedDuplicate).toBe(0)
  })

  it('excludes churned-only families by default (includeChurned: false)', async () => {
    const reg = makeReg({
      id: 'reg-1',
      name: 'Child One',
      stripeSubscriptionIdDugsi: 'sub_1',
      subscriptionStatus: SubscriptionStatus.canceled,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(0)
    expect(result?.data?.skippedChurned).toBe(1)
  })

  it('includes churned families when includeChurned: true', async () => {
    const reg = makeReg({
      id: 'reg-1',
      name: 'Child One',
      stripeSubscriptionIdDugsi: 'sub_1',
      subscriptionStatus: SubscriptionStatus.canceled,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg])

    const result = await generateDugsiVCardContent({ includeChurned: true })
    expect(result?.data?.exported).toBe(1)
  })

  it('keeps mixed-status families when includeChurned: false', async () => {
    const reg1 = makeReg({
      id: 'reg-1',
      name: 'Child One',
      familyReferenceId: 'fam-mixed',
      stripeSubscriptionIdDugsi: 'sub_canceled',
      subscriptionStatus: SubscriptionStatus.canceled,
    })
    const reg2 = makeReg({
      id: 'reg-2',
      name: 'Child Two',
      familyReferenceId: 'fam-mixed',
      stripeSubscriptionIdDugsi: 'sub_active',
      subscriptionStatus: SubscriptionStatus.active,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg1, reg2])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
  })

  it('filename includes shift when scoped', async () => {
    mockGetAllDugsiRegistrations.mockResolvedValue([makeReg()])

    const result = await generateDugsiVCardContent({ shift: 'MORNING' })
    expect(result?.data?.filename).toContain('dugsi-morning-')
    expect(mockGetAllDugsiRegistrations).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ shift: 'MORNING' })
    )
  })

  it('ORG includes shift when scoped', async () => {
    mockGetAllDugsiRegistrations.mockResolvedValue([makeReg()])

    const result = await generateDugsiVCardContent({ shift: 'AFTERNOON' })
    expect(result?.data?.content).toContain('ORG:Dugsi - AFTERNOON')
  })

  it('filename has no shift prefix when no shift specified', async () => {
    mockGetAllDugsiRegistrations.mockResolvedValue([makeReg()])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.filename).toMatch(/^dugsi-parent-contacts-/)
  })

  it('ORG is Irshad Dugsi when no shift specified', async () => {
    mockGetAllDugsiRegistrations.mockResolvedValue([makeReg()])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.content).toContain('ORG:Irshad Dugsi')
  })

  it('emits logger.info with the documented structured fields', async () => {
    mockGetAllDugsiRegistrations.mockResolvedValue([makeReg()])

    await generateDugsiVCardContent({ shift: 'MORNING', includeChurned: true })

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1)
    const [fields, msg] = mockLoggerInfo.mock.calls[0]
    expect(msg).toBe('Dugsi contacts exported')
    expect(fields).toMatchObject({
      exported: expect.any(Number),
      skippedNoContact: expect.any(Number),
      skippedDuplicate: expect.any(Number),
      skippedChurned: expect.any(Number),
      totalFamilies: expect.any(Number),
      includeChurned: true,
      shift: 'MORNING',
    })
  })

  it('parent1 and parent2 sharing a phone within the same family increments skippedDuplicate by 1', async () => {
    const sharedPhone = '6125551234'
    const reg = makeReg({
      id: 'reg-1',
      name: 'Child One',
      parentEmail: null,
      parentPhone: sharedPhone,
      parent2FirstName: 'Fatima',
      parent2LastName: 'Hassan',
      parent2Email: null,
      parent2Phone: sharedPhone,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg])

    const result = await generateDugsiVCardContent({ includeChurned: true })
    expect(result?.data?.exported).toBe(1)
    expect(result?.data?.skippedDuplicate).toBe(1)
  })

  it('same parent email+phone in family A, phone-only in family B emits one contact with both children merged', async () => {
    const regA = makeReg({
      id: 'reg-a',
      name: 'Child Alpha',
      familyReferenceId: 'fam-A',
      parentEmail: 'shared@example.com',
      parentPhone: '6125559999',
    })
    const regB = makeReg({
      id: 'reg-b',
      name: 'Child Beta',
      familyReferenceId: 'fam-B',
      parentEmail: null,
      parentPhone: '6125559999',
      parent2Email: null,
      parent2Phone: null,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([regA, regB])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    expect(result?.data?.skippedDuplicate).toBe(1)
    const note = result?.data?.content ?? ''
    expect(note).toMatch(/NOTE:Children: .*Child Alpha.*Child Beta/)
  })

  it('phone-only family A, email+phone family B merges and the vCard carries both identifiers', async () => {
    const regA = makeReg({
      id: 'reg-a',
      name: 'Child Alpha',
      familyReferenceId: 'fam-A',
      parentEmail: null,
      parentPhone: '6125559999',
    })
    const regB = makeReg({
      id: 'reg-b',
      name: 'Child Beta',
      familyReferenceId: 'fam-B',
      parentEmail: 'new@example.com',
      parentPhone: '6125559999',
      parent2Email: null,
      parent2Phone: null,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([regA, regB])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    expect(result?.data?.skippedDuplicate).toBe(1)
    const content = result?.data?.content ?? ''
    expect(content).toContain('+16125559999')
    expect(content).toContain('new@example.com')
  })

  it('non-bridge duplicate promotes real name onto Dugsi Parent fallback', async () => {
    const regA = makeReg({
      id: 'reg-a',
      name: 'Child Alpha',
      familyReferenceId: 'fam-A',
      parentFirstName: '',
      parentLastName: '',
      parentEmail: null,
      parentPhone: '6125559999',
    })
    const regB = makeReg({
      id: 'reg-b',
      name: 'Child Beta',
      familyReferenceId: 'fam-B',
      parentFirstName: 'Omar',
      parentLastName: 'Hassan',
      parentEmail: 'omar@example.com',
      parentPhone: '6125559999',
      parent2Email: null,
      parent2Phone: null,
    })
    // A→B: A creates 'Dugsi Parent' fallback; B is a duplicate via phone, has real name + email
    mockGetAllDugsiRegistrations.mockResolvedValue([regA, regB])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    const content = result?.data?.content ?? ''
    expect(content).toContain('Omar')
    expect(content).toContain('Hassan')
    expect(content).toContain('omar@example.com')
    expect(content).not.toContain('Dugsi Parent')
  })

  it('parent2 with name but no contact info increments skippedNoContact', async () => {
    const reg = makeReg({
      id: 'reg-1',
      name: 'Child One',
      parentEmail: 'parent1@example.com',
      parentPhone: null,
      parent2FirstName: 'Fatima',
      parent2LastName: 'Hassan',
      parent2Email: null,
      parent2Phone: null,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    expect(result?.data?.skippedNoContact).toBe(1)
  })

  it('phone-only family A, email+phone family B, email-only family C all resolve to one contact', async () => {
    const regA = makeReg({
      id: 'reg-a',
      name: 'Child Alpha',
      familyReferenceId: 'fam-A',
      parentEmail: null,
      parentPhone: '6125559999',
    })
    const regB = makeReg({
      id: 'reg-b',
      name: 'Child Beta',
      familyReferenceId: 'fam-B',
      parentEmail: 'shared@example.com',
      parentPhone: '6125559999',
      parent2Email: null,
      parent2Phone: null,
    })
    const regC = makeReg({
      id: 'reg-c',
      name: 'Child Gamma',
      familyReferenceId: 'fam-C',
      parentEmail: 'shared@example.com',
      parentPhone: null,
      parent2Email: null,
      parent2Phone: null,
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([regA, regB, regC])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    expect(result?.data?.skippedDuplicate).toBe(2)
    const note = result?.data?.content ?? ''
    expect(vcardCount(note)).toBe(1)
    expect(note).toMatch(/NOTE:Children: .*Child Alpha.*Child Beta.*Child Gamma/)
  })

  it('3-family dedup resolves correctly regardless of ordering (A→C→B)', async () => {
    const regA = makeReg({
      id: 'reg-a',
      name: 'Child Alpha',
      familyReferenceId: 'fam-A',
      parentEmail: null,
      parentPhone: '6125559999',
    })
    const regB = makeReg({
      id: 'reg-b',
      name: 'Child Beta',
      familyReferenceId: 'fam-B',
      parentEmail: 'shared@example.com',
      parentPhone: '6125559999',
      parent2Email: null,
      parent2Phone: null,
    })
    const regC = makeReg({
      id: 'reg-c',
      name: 'Child Gamma',
      familyReferenceId: 'fam-C',
      parentEmail: 'shared@example.com',
      parentPhone: null,
      parent2Email: null,
      parent2Phone: null,
    })
    // A→C→B: bridge record B arrives last, after A and C are already separate contacts
    mockGetAllDugsiRegistrations.mockResolvedValue([regA, regC, regB])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    expect(result?.data?.skippedDuplicate).toBe(2)
    const content = result?.data?.content ?? ''
    expect(content).toContain('Child Alpha')
    expect(content).toContain('Child Beta')
    expect(content).toContain('Child Gamma')
    // merged contact must carry both identifiers from the absorbed records
    expect(content).toContain('+16125559999')
    expect(content).toContain('shared@example.com')
  })

  it('bridge merge preserves real name over Dugsi Parent fallback', async () => {
    const regA = makeReg({
      id: 'reg-a',
      name: 'Child Alpha',
      familyReferenceId: 'fam-A',
      parentFirstName: '',
      parentLastName: '',
      parentEmail: null,
      parentPhone: '6125559999',
    })
    const regC = makeReg({
      id: 'reg-c',
      name: 'Child Gamma',
      familyReferenceId: 'fam-C',
      parentFirstName: 'Sara',
      parentLastName: 'Ahmed',
      parentEmail: 'sara@example.com',
      parentPhone: null,
      parent2Email: null,
      parent2Phone: null,
    })
    const regB = makeReg({
      id: 'reg-b',
      name: 'Child Beta',
      familyReferenceId: 'fam-B',
      parentFirstName: 'Sara',
      parentLastName: 'Ahmed',
      parentEmail: 'sara@example.com',
      parentPhone: '6125559999',
      parent2Email: null,
      parent2Phone: null,
    })
    // A→C→B: A creates a 'Dugsi Parent' fallback contact; C creates a named contact;
    // B bridges them — the merged contact must keep Sara Ahmed's name, not 'Dugsi Parent'
    mockGetAllDugsiRegistrations.mockResolvedValue([regA, regC, regB])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    const content = result?.data?.content ?? ''
    expect(content).toContain('Sara')
    expect(content).toContain('Ahmed')
    expect(content).not.toContain('Dugsi Parent')
  })

  it('parent1 email+phone, parent2 same phone treated as intra-family duplicate', async () => {
    const reg = makeReg({
      id: 'reg-1',
      name: 'Child One',
      parentEmail: 'parent@example.com',
      parentPhone: '6125551234',
      parent2FirstName: 'Fatima',
      parent2LastName: 'Hassan',
      parent2Email: null,
      parent2Phone: '6125551234',
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
    expect(result?.data?.skippedDuplicate).toBe(1)
  })
})
