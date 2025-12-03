import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { Family, DugsiRegistration } from '@/app/admin/dugsi/_types'
import type { MahadStudent } from '@/app/admin/mahad/_types'
import { StudentStatus } from '@/lib/types/student'

import {
  escapeVCardValue,
  formatPhoneForVCard,
  generateVCard,
  exportMahadStudentsToVCard,
  exportDugsiParentsToVCard,
} from '../vcard-export'

function createMahadStudent(
  overrides: Partial<MahadStudent> = {}
): MahadStudent {
  return {
    id: 'test-id',
    name: 'Test Student',
    email: null,
    phone: null,
    dateOfBirth: null,
    gradeLevel: null,
    schoolName: null,
    graduationStatus: null,
    paymentFrequency: null,
    billingType: null,
    paymentNotes: null,
    status: StudentStatus.ENROLLED,
    batchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    batch: null,
    subscription: null,
    ...overrides,
  }
}

function createDugsiRegistration(
  overrides: Partial<DugsiRegistration> = {}
): DugsiRegistration {
  return {
    id: 'test-id',
    name: 'Test Child',
    gender: null,
    dateOfBirth: null,
    gradeLevel: null,
    schoolName: null,
    healthInfo: null,
    createdAt: new Date(),
    parentFirstName: null,
    parentLastName: null,
    parentEmail: null,
    parentPhone: null,
    parent2FirstName: null,
    parent2LastName: null,
    parent2Email: null,
    parent2Phone: null,
    primaryPayerParentNumber: null,
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
    familyReferenceId: null,
    stripeAccountType: null,
    ...overrides,
  }
}

function createFamily(
  members: DugsiRegistration[],
  overrides: Partial<Omit<Family, 'members'>> = {}
): Family {
  return {
    familyKey: 'test-family',
    members,
    hasPayment: false,
    hasSubscription: false,
    parentEmail: null,
    parentPhone: null,
    ...overrides,
  }
}

describe('escapeVCardValue', () => {
  it('should escape backslashes', () => {
    expect(escapeVCardValue('test\\value')).toBe('test\\\\value')
  })

  it('should escape semicolons', () => {
    expect(escapeVCardValue('test;value')).toBe('test\\;value')
  })

  it('should escape commas', () => {
    expect(escapeVCardValue('test,value')).toBe('test\\,value')
  })

  it('should escape newlines', () => {
    expect(escapeVCardValue('test\nvalue')).toBe('test\\nvalue')
  })

  it('should handle multiple special characters', () => {
    expect(escapeVCardValue('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })

  it('should return unchanged string when no special chars', () => {
    expect(escapeVCardValue('simple text')).toBe('simple text')
  })
})

describe('formatPhoneForVCard', () => {
  it('should return undefined for null', () => {
    expect(formatPhoneForVCard(null)).toBeUndefined()
  })

  it('should return undefined for undefined', () => {
    expect(formatPhoneForVCard(undefined)).toBeUndefined()
  })

  it('should return undefined for empty string', () => {
    expect(formatPhoneForVCard('')).toBeUndefined()
  })

  it('should format 10-digit US number with +1 prefix', () => {
    expect(formatPhoneForVCard('6125551234')).toBe('+16125551234')
  })

  it('should format 10-digit number with formatting', () => {
    expect(formatPhoneForVCard('(612) 555-1234')).toBe('+16125551234')
  })

  it('should format 11-digit number starting with 1', () => {
    expect(formatPhoneForVCard('16125551234')).toBe('+16125551234')
  })

  it('should format 11-digit number with formatting', () => {
    expect(formatPhoneForVCard('1-612-555-1234')).toBe('+16125551234')
  })

  it('should handle other digit lengths with + prefix', () => {
    expect(formatPhoneForVCard('12345')).toBe('+12345')
  })
})

describe('generateVCard', () => {
  it('should generate basic vCard with required fields', () => {
    const vcard = generateVCard({
      firstName: 'John Doe',
      lastName: '',
      fullName: 'John Doe',
    })

    expect(vcard).toContain('BEGIN:VCARD')
    expect(vcard).toContain('VERSION:3.0')
    expect(vcard).toContain('N:;John Doe;;;')
    expect(vcard).toContain('FN:John Doe')
    expect(vcard).toContain('END:VCARD')
  })

  it('should include phone when provided', () => {
    const vcard = generateVCard({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      phone: '+16125551234',
    })

    expect(vcard).toContain('TEL;TYPE=CELL:+16125551234')
  })

  it('should include email when provided', () => {
    const vcard = generateVCard({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      email: 'john@example.com',
    })

    expect(vcard).toContain('EMAIL:john@example.com')
  })

  it('should include organization when provided', () => {
    const vcard = generateVCard({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      organization: 'Irshad Center',
    })

    expect(vcard).toContain('ORG:Irshad Center')
  })

  it('should include note when provided', () => {
    const vcard = generateVCard({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      note: 'Children: Ahmed, Fatima',
    })

    expect(vcard).toContain('NOTE:Children: Ahmed\\, Fatima')
  })

  it('should escape special characters in fields', () => {
    const vcard = generateVCard({
      firstName: 'John; Jr.',
      lastName: 'Doe',
      fullName: 'John; Jr. Doe',
    })

    expect(vcard).toContain('N:Doe;John\\; Jr.;;;')
    expect(vcard).toContain('FN:John\\; Jr. Doe')
  })

  it('should use CRLF line endings', () => {
    const vcard = generateVCard({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
    })

    expect(vcard).toContain('\r\n')
    expect(vcard).not.toMatch(/[^\r]\n/)
  })
})

describe('exportMahadStudentsToVCard', () => {
  let mockClick: ReturnType<typeof vi.fn>
  let mockAppendChild: ReturnType<typeof vi.fn>
  let mockRemoveChild: ReturnType<typeof vi.fn>
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockClick = vi.fn()
    mockAppendChild = vi.fn()
    mockRemoveChild = vi.fn()
    mockRevokeObjectURL = vi.fn()

    vi.stubGlobal(
      'Blob',
      class MockBlob {
        constructor(
          public content: string[],
          public options: object
        ) {}
      }
    )
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: mockRevokeObjectURL,
    })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        href: '',
        download: '',
        click: mockClick,
      })),
      body: {
        appendChild: mockAppendChild,
        removeChild: mockRemoveChild,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should return empty result for empty array', () => {
    const result = exportMahadStudentsToVCard([])
    expect(result).toEqual({ exported: 0, skipped: 0 })
    expect(mockClick).not.toHaveBeenCalled()
  })

  it('should skip students without phone or email', () => {
    const students = [
      createMahadStudent({ id: '1', name: 'Student One' }),
      createMahadStudent({ id: '2', name: 'Student Two' }),
    ]

    const result = exportMahadStudentsToVCard(students)
    expect(result).toEqual({ exported: 0, skipped: 2 })
    expect(mockClick).not.toHaveBeenCalled()
  })

  it('should export students with contact info', () => {
    const students = [
      createMahadStudent({ id: '1', name: 'Student One', phone: '6125551234' }),
      createMahadStudent({
        id: '2',
        name: 'Student Two',
        email: 'student2@example.com',
      }),
    ]

    const result = exportMahadStudentsToVCard(students)
    expect(result.exported).toBe(2)
    expect(result.skipped).toBe(0)
    expect(mockClick).toHaveBeenCalled()
  })

  it('should include batch name in contact when provided', () => {
    const students = [
      createMahadStudent({
        id: '1',
        name: 'Student One',
        phone: '6125551234',
        batchId: 'b1',
        batch: { id: 'b1', name: 'Cohort A', startDate: null, endDate: null },
      }),
    ]

    const result = exportMahadStudentsToVCard(students)
    expect(result.exported).toBe(1)
    expect(mockClick).toHaveBeenCalled()
  })

  it('should use batchName parameter when student has no batch', () => {
    const students = [
      createMahadStudent({ id: '1', name: 'Student One', phone: '6125551234' }),
    ]

    const result = exportMahadStudentsToVCard(students, 'Cohort B')
    expect(result.exported).toBe(1)
    expect(mockClick).toHaveBeenCalled()
  })

  it('should return downloadFailed when browser APIs throw', () => {
    vi.stubGlobal(
      'Blob',
      class MockBlob {
        constructor() {
          throw new Error('Blob creation failed')
        }
      }
    )

    const students = [
      createMahadStudent({ id: '1', name: 'Student One', phone: '6125551234' }),
    ]

    const result = exportMahadStudentsToVCard(students)
    expect(result.downloadFailed).toBe(true)
    expect(result.exported).toBe(0)
  })
})

describe('exportDugsiParentsToVCard', () => {
  let mockClick: ReturnType<typeof vi.fn>
  let mockAppendChild: ReturnType<typeof vi.fn>
  let mockRemoveChild: ReturnType<typeof vi.fn>
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockClick = vi.fn()
    mockAppendChild = vi.fn()
    mockRemoveChild = vi.fn()
    mockRevokeObjectURL = vi.fn()

    vi.stubGlobal(
      'Blob',
      class MockBlob {
        constructor(
          public content: string[],
          public options: object
        ) {}
      }
    )
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: mockRevokeObjectURL,
    })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        href: '',
        download: '',
        click: mockClick,
      })),
      body: {
        appendChild: mockAppendChild,
        removeChild: mockRemoveChild,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should return empty result for empty array', () => {
    const result = exportDugsiParentsToVCard([])
    expect(result).toEqual({ exported: 0, skipped: 0 })
    expect(mockClick).not.toHaveBeenCalled()
  })

  it('should skip families with no members', () => {
    const families = [createFamily([])]

    const result = exportDugsiParentsToVCard(families)
    expect(result).toEqual({ exported: 0, skipped: 0 })
  })

  it('should skip parents without contact info', () => {
    const families = [
      createFamily([
        createDugsiRegistration({
          id: 'm1',
          name: 'Child One',
          parentFirstName: 'Parent',
          parentLastName: 'One',
        }),
      ]),
    ]

    const result = exportDugsiParentsToVCard(families)
    expect(result.exported).toBe(0)
    expect(result.skipped).toBe(1)
  })

  it('should export parent with phone', () => {
    const families = [
      createFamily([
        createDugsiRegistration({
          id: 'm1',
          name: 'Child One',
          parentFirstName: 'Parent',
          parentLastName: 'One',
          parentPhone: '6125551234',
        }),
      ]),
    ]

    const result = exportDugsiParentsToVCard(families)
    expect(result.exported).toBe(1)
    expect(result.skipped).toBe(0)
    expect(mockClick).toHaveBeenCalled()
  })

  it('should export parent with email', () => {
    const families = [
      createFamily([
        createDugsiRegistration({
          id: 'm1',
          name: 'Child One',
          parentFirstName: 'Parent',
          parentLastName: 'One',
          parentEmail: 'parent@example.com',
        }),
      ]),
    ]

    const result = exportDugsiParentsToVCard(families)
    expect(result.exported).toBe(1)
    expect(result.skipped).toBe(0)
  })

  it('should export both parents when both have contact info', () => {
    const families = [
      createFamily([
        createDugsiRegistration({
          id: 'm1',
          name: 'Child One',
          parentFirstName: 'Parent',
          parentLastName: 'One',
          parentEmail: 'parent1@example.com',
          parentPhone: '6125551234',
          parent2FirstName: 'Parent',
          parent2LastName: 'Two',
          parent2Email: 'parent2@example.com',
          parent2Phone: '6125555678',
        }),
      ]),
    ]

    const result = exportDugsiParentsToVCard(families)
    expect(result.exported).toBe(2)
    expect(result.skipped).toBe(0)
  })

  it('should deduplicate parents by email across families', () => {
    const families = [
      createFamily(
        [
          createDugsiRegistration({
            id: 'm1',
            name: 'Child One',
            parentFirstName: 'Parent',
            parentLastName: 'One',
            parentEmail: 'parent@example.com',
            parentPhone: '6125551234',
          }),
        ],
        { familyKey: 'f1' }
      ),
      createFamily(
        [
          createDugsiRegistration({
            id: 'm2',
            name: 'Child Two',
            parentFirstName: 'Parent',
            parentLastName: 'One',
            parentEmail: 'PARENT@EXAMPLE.COM',
            parentPhone: '6125551234',
          }),
        ],
        { familyKey: 'f2' }
      ),
    ]

    const result = exportDugsiParentsToVCard(families)
    expect(result.exported).toBe(1)
    expect(result.skipped).toBe(1)
  })

  it('should return downloadFailed when browser APIs throw', () => {
    vi.stubGlobal(
      'Blob',
      class MockBlob {
        constructor() {
          throw new Error('Blob creation failed')
        }
      }
    )

    const families = [
      createFamily([
        createDugsiRegistration({
          id: 'm1',
          name: 'Child One',
          parentFirstName: 'Parent',
          parentLastName: 'One',
          parentEmail: 'parent@example.com',
        }),
      ]),
    ]

    const result = exportDugsiParentsToVCard(families)
    expect(result.downloadFailed).toBe(true)
    expect(result.exported).toBe(0)
  })
})
