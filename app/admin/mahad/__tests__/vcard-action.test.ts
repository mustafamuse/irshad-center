import { vi, describe, it, expect, beforeEach } from 'vitest'

import type { MahadStudent } from '@/lib/db/queries/student'
import { StudentStatus } from '@/lib/types/student'

import { createAdminActionClientMock } from '../../_test-utils/admin-action-client-mock'

const { mockGetStudents, mockGetStudentsByBatch, mockLoggerInfo } = vi.hoisted(
  () => ({
    mockGetStudents: vi.fn(),
    mockGetStudentsByBatch: vi.fn(),
    mockLoggerInfo: vi.fn(),
  })
)

vi.mock('@/lib/safe-action', () => ({
  adminActionClient: createAdminActionClientMock(),
}))

vi.mock('@/lib/db/queries/student', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/db/queries/student')>()
  return {
    ...original,
    getStudents: (...args: unknown[]) => mockGetStudents(...args),
    getStudentsByBatch: (...args: unknown[]) => mockGetStudentsByBatch(...args),
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

import { generateMahadVCardContent } from '../_actions/vcard-actions'

function makeStudent(overrides: Partial<MahadStudent> = {}): MahadStudent {
  return {
    id: 'student-1',
    name: 'Ahmed Hassan',
    email: 'ahmed@example.com',
    phone: '6125551234',
    dateOfBirth: null,
    gradeLevel: null,
    schoolName: null,
    graduationStatus: null,
    paymentFrequency: null,
    billingType: null,
    paymentNotes: null,
    status: StudentStatus.ENROLLED,
    batchId: 'batch-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    batch: {
      id: 'batch-1',
      name: 'Batch A',
      startDate: new Date('2024-01-01'),
      endDate: null,
    },
    subscription: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateMahadVCardContent', () => {
  it('return shape has skippedNoContact and omits skippedDuplicate', async () => {
    const student = makeStudent({ phone: null, email: null })
    const exported = makeStudent()
    mockGetStudents.mockResolvedValue([student, exported])

    const result = await generateMahadVCardContent({})
    expect(result?.data?.skippedNoContact).toBe(1)
    expect(result?.data?.skippedDuplicate).toBeUndefined()
    expect(result?.data?.exported).toBe(1)
  })

  it('emits logger.info with exported, skippedNoContact, batchId', async () => {
    const student = makeStudent()
    mockGetStudents.mockResolvedValue([student])

    await generateMahadVCardContent({})

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1)
    const [fields, msg] = mockLoggerInfo.mock.calls[0]
    expect(msg).toBe('Mahad contacts exported')
    expect(fields).toMatchObject({
      exported: expect.any(Number),
      skippedNoContact: expect.any(Number),
      batchId: undefined,
    })
    expect(fields).not.toHaveProperty('skippedDuplicate')
  })

  it('uses getStudentsByBatch and slugs the batch name into the filename', async () => {
    const student = makeStudent()
    mockGetStudentsByBatch.mockResolvedValue([student])

    const result = await generateMahadVCardContent({
      batchId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(mockGetStudentsByBatch).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000'
    )
    expect(result?.data?.exported).toBe(1)
    expect(result?.data?.filename).toMatch(/^mahad-batch-a-contacts-/)
  })

  it('uses the default mahad-all-contacts filename when no batchId is supplied', async () => {
    mockGetStudents.mockResolvedValue([makeStudent()])

    const result = await generateMahadVCardContent({})
    expect(result?.data?.filename).toMatch(/^mahad-all-contacts-/)
  })
})
