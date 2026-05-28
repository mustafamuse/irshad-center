import { vi, describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'

const { mockGetAllDugsiRegistrations, mockLoggerInfo } = vi.hoisted(() => ({
  mockGetAllDugsiRegistrations: vi.fn(),
  mockLoggerInfo: vi.fn(),
}))

vi.mock('@/lib/safe-action', () => {
  function makeClient() {
    const client = {
      metadata: () => client,
      use: () => client,
      schema: (schema: z.ZodType) => ({
        action:
          (handler: (args: { parsedInput: unknown }) => Promise<unknown>) =>
          async (input: unknown) => {
            const parsed = schema.safeParse(input)
            if (!parsed.success) {
              return { validationErrors: parsed.error.flatten().fieldErrors }
            }
            try {
              const data = await handler({ parsedInput: parsed.data })
              return { data }
            } catch (error) {
              const { ActionError } = await import('@/lib/errors/action-error')
              if (error instanceof ActionError)
                return { serverError: error.message }
              return { serverError: 'Something went wrong' }
            }
          },
      }),
      action: (handler: () => Promise<unknown>) => async () => {
        try {
          const data = await handler()
          return { data }
        } catch (error) {
          const { ActionError } = await import('@/lib/errors/action-error')
          if (error instanceof ActionError)
            return {
              serverError: (error as InstanceType<typeof ActionError>).message,
            }
          return { serverError: 'Something went wrong' }
        }
      },
    }
    return client
  }
  return { adminActionClient: makeClient() }
})

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('next/server', () => ({
  after: vi.fn((cb: () => void) => cb()),
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
    subscriptionStatus: 'active',
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
    expect(result?.data?.content).toContain('Child One')
    expect(result?.data?.content).toContain('Child Two')
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
    expect(note).toContain('Child Alpha')
    expect(note).toContain('Child Beta')
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
    expect(result?.data?.content).toContain('FN:Dugsi Parent')
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
    expect(result?.data?.skippedDuplicate).toBeDefined()
  })

  it('excludes churned-only families by default (includeChurned: false)', async () => {
    const reg = makeReg({
      id: 'reg-1',
      name: 'Child One',
      stripeSubscriptionIdDugsi: 'sub_1',
      subscriptionStatus: 'canceled',
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(0)
  })

  it('includes churned families when includeChurned: true', async () => {
    const reg = makeReg({
      id: 'reg-1',
      name: 'Child One',
      stripeSubscriptionIdDugsi: 'sub_1',
      subscriptionStatus: 'canceled',
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
      subscriptionStatus: 'canceled',
    })
    const reg2 = makeReg({
      id: 'reg-2',
      name: 'Child Two',
      familyReferenceId: 'fam-mixed',
      stripeSubscriptionIdDugsi: 'sub_active',
      subscriptionStatus: 'active',
    })
    mockGetAllDugsiRegistrations.mockResolvedValue([reg1, reg2])

    const result = await generateDugsiVCardContent({})
    expect(result?.data?.exported).toBe(1)
  })

  it('filename includes shift when scoped', async () => {
    mockGetAllDugsiRegistrations.mockResolvedValue([makeReg()])

    const result = await generateDugsiVCardContent({ shift: 'MORNING' })
    expect(result?.data?.filename).toContain('dugsi-morning-')
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
    expect(note).toContain('Child Alpha')
    expect(note).toContain('Child Beta')
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
})
