import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockCreateBatch,
  mockDeleteBatch,
  mockGetBatchById,
  mockAssignStudentsToBatch,
  mockTransferStudents,
  mockGetStudentById,
  mockResolveDuplicateStudents,
  mockGetStudentDeleteWarnings,
  mockPrismaDelete,
  mockPrismaTransaction,
  mockPrismaFindUnique,
  mockRevalidatePath,
  mockLoggerError,
  mockLoggerWarn,
  mockStripeSessionCreate,
} = vi.hoisted(() => ({
  mockCreateBatch: vi.fn(),
  mockDeleteBatch: vi.fn(),
  mockGetBatchById: vi.fn(),
  mockAssignStudentsToBatch: vi.fn(),
  mockTransferStudents: vi.fn(),
  mockGetStudentById: vi.fn(),
  mockResolveDuplicateStudents: vi.fn(),
  mockGetStudentDeleteWarnings: vi.fn(),
  mockPrismaDelete: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockPrismaFindUnique: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockStripeSessionCreate: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      delete: (...args: unknown[]) => mockPrismaDelete(...args),
      findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      mockPrismaTransaction(fn),
  },
}))

vi.mock('@/lib/db/queries/batch', () => ({
  createBatch: (...args: unknown[]) => mockCreateBatch(...args),
  deleteBatch: (...args: unknown[]) => mockDeleteBatch(...args),
  getBatchById: (...args: unknown[]) => mockGetBatchById(...args),
  assignStudentsToBatch: (...args: unknown[]) =>
    mockAssignStudentsToBatch(...args),
  transferStudents: (...args: unknown[]) => mockTransferStudents(...args),
}))

vi.mock('@/lib/db/queries/student', () => ({
  getStudentById: (...args: unknown[]) => mockGetStudentById(...args),
  resolveDuplicateStudents: (...args: unknown[]) =>
    mockResolveDuplicateStudents(...args),
  getStudentDeleteWarnings: (...args: unknown[]) =>
    mockGetStudentDeleteWarnings(...args),
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: vi.fn(() => ({
    error: mockLoggerError,
    warn: mockLoggerWarn,
    info: vi.fn(),
    debug: vi.fn(),
  })),
}))

vi.mock('@/lib/stripe-mahad', () => ({
  getMahadStripeClient: vi.fn(() => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeSessionCreate(...args),
      },
    },
  })),
}))

vi.mock('@/lib/keys/stripe', () => ({
  getMahadKeys: vi.fn(() => ({
    productId: 'prod_test123',
  })),
}))

vi.mock('@/lib/utils/mahad-tuition', () => ({
  calculateMahadRate: vi.fn(() => 15000),
  getStripeInterval: vi.fn(() => ({ interval: 'month', interval_count: 1 })),
}))

import {
  createBatchAction,
  deleteBatchAction,
  assignStudentsAction,
  transferStudentsAction,
  resolveDuplicatesAction,
  deleteStudentAction,
  bulkDeleteStudentsAction,
  getStudentDeleteWarningsAction,
  generatePaymentLinkAction,
} from '../index'

const VALID_BATCH_ID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_BATCH_ID_2 = '550e8400-e29b-41d4-a716-446655440001'
const VALID_STUDENT_ID = '550e8400-e29b-41d4-a716-446655440002'
const VALID_STUDENT_ID_2 = '550e8400-e29b-41d4-a716-446655440003'
const VALID_STUDENT_ID_3 = '550e8400-e29b-41d4-a716-446655440004'

describe('Batch Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createBatchAction', () => {
    it('should create a batch with valid data', async () => {
      const formData = new FormData()
      formData.set('name', 'Test Cohort')
      formData.set('startDate', '2024-01-15')

      const mockBatch = { id: 'batch-1', name: 'Test Cohort' }
      mockCreateBatch.mockResolvedValue(mockBatch)

      const result = await createBatchAction(formData)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockBatch)
      expect(mockCreateBatch).toHaveBeenCalledWith({
        name: 'Test Cohort',
        startDate: expect.any(Date),
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/mahad')
    })

    it('should return validation error for empty name', async () => {
      const formData = new FormData()
      formData.set('name', '')

      const result = await createBatchAction(formData)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should handle duplicate name error', async () => {
      const formData = new FormData()
      formData.set('name', 'Existing Cohort')

      const prismaError = new Error('Unique constraint failed')
      Object.assign(prismaError, { code: 'P2002' })
      mockCreateBatch.mockRejectedValue(prismaError)

      const result = await createBatchAction(formData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('already exists')
    })
  })

  describe('deleteBatchAction', () => {
    it('should delete an empty batch', async () => {
      mockGetBatchById.mockResolvedValue({
        id: 'batch-1',
        name: 'Empty Cohort',
        studentCount: 0,
      })
      mockDeleteBatch.mockResolvedValue(undefined)

      const result = await deleteBatchAction('batch-1')

      expect(result.success).toBe(true)
      expect(mockDeleteBatch).toHaveBeenCalledWith('batch-1')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/mahad')
    })

    it('should reject deletion of batch with students', async () => {
      mockGetBatchById.mockResolvedValue({
        id: 'batch-1',
        name: 'Active Cohort',
        studentCount: 5,
      })

      const result = await deleteBatchAction('batch-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot delete cohort')
      expect(result.error).toContain('5 students enrolled')
      expect(mockDeleteBatch).not.toHaveBeenCalled()
    })

    it('should return error for non-existent batch', async () => {
      mockGetBatchById.mockResolvedValue(null)

      const result = await deleteBatchAction('non-existent')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cohort not found')
    })
  })

  describe('assignStudentsAction', () => {
    it('should assign students to a batch', async () => {
      mockGetBatchById.mockResolvedValue({ id: VALID_BATCH_ID, name: 'Target' })
      mockAssignStudentsToBatch.mockResolvedValue({
        assignedCount: 3,
        failedAssignments: [],
      })

      const result = await assignStudentsAction(VALID_BATCH_ID, [
        VALID_STUDENT_ID,
        VALID_STUDENT_ID_2,
        VALID_STUDENT_ID_3,
      ])

      expect(result.success).toBe(true)
      expect(result.data?.assignedCount).toBe(3)
      expect(result.data?.failedAssignments).toEqual([])
    })

    it('should return error for non-existent batch', async () => {
      mockGetBatchById.mockResolvedValue(null)

      const result = await assignStudentsAction(VALID_BATCH_ID, [
        VALID_STUDENT_ID,
      ])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cohort not found')
    })

    it('should return validation error for empty student list', async () => {
      const result = await assignStudentsAction(VALID_BATCH_ID, [])

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })

  describe('transferStudentsAction', () => {
    it('should transfer students between batches', async () => {
      mockGetBatchById
        .mockResolvedValueOnce({ id: VALID_BATCH_ID, name: 'Source' })
        .mockResolvedValueOnce({ id: VALID_BATCH_ID_2, name: 'Destination' })
      mockTransferStudents.mockResolvedValue({
        transferredCount: 2,
        failedTransfers: [],
      })

      const result = await transferStudentsAction(
        VALID_BATCH_ID,
        VALID_BATCH_ID_2,
        [VALID_STUDENT_ID, VALID_STUDENT_ID_2]
      )

      expect(result.success).toBe(true)
      expect(result.data?.transferredCount).toBe(2)
    })

    it('should reject transfer to same batch', async () => {
      mockGetBatchById.mockResolvedValue({
        id: VALID_BATCH_ID,
        name: 'Same Cohort',
      })

      const result = await transferStudentsAction(
        VALID_BATCH_ID,
        VALID_BATCH_ID,
        [VALID_STUDENT_ID]
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot transfer within the same cohort')
    })

    it('should return error when source batch not found', async () => {
      mockGetBatchById.mockResolvedValueOnce(null)

      const result = await transferStudentsAction(
        VALID_BATCH_ID,
        VALID_BATCH_ID_2,
        [VALID_STUDENT_ID]
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Source cohort not found')
    })
  })
})

describe('Student Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deleteStudentAction', () => {
    it('should delete an existing student', async () => {
      mockGetStudentById.mockResolvedValue({ id: 'student-1', batchId: null })
      mockPrismaDelete.mockResolvedValue(undefined)

      const result = await deleteStudentAction('student-1')

      expect(result.success).toBe(true)
      expect(mockPrismaDelete).toHaveBeenCalledWith({
        where: { id: 'student-1' },
      })
    })

    it('should revalidate batch path if student has batch', async () => {
      mockGetStudentById.mockResolvedValue({
        id: 'student-1',
        batchId: 'batch-1',
      })
      mockPrismaDelete.mockResolvedValue(undefined)

      await deleteStudentAction('student-1')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/mahad')
    })

    it('should return error for non-existent student', async () => {
      mockGetStudentById.mockResolvedValue(null)

      const result = await deleteStudentAction('non-existent')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Student not found')
    })
  })

  describe('bulkDeleteStudentsAction', () => {
    it('should delete multiple students', async () => {
      mockGetStudentById.mockResolvedValue({ id: 'test', batchId: null })
      mockPrismaDelete.mockResolvedValue(undefined)

      const result = await bulkDeleteStudentsAction([
        'student-1',
        'student-2',
        'student-3',
      ])

      expect(result.success).toBe(true)
      expect(result.data?.deletedCount).toBe(3)
      expect(result.data?.failedDeletes).toEqual([])
    })

    it('should return error for empty student list', async () => {
      const result = await bulkDeleteStudentsAction([])

      expect(result.success).toBe(false)
      expect(result.error).toBe('No students selected for deletion')
    })

    it('should track failed deletions', async () => {
      mockGetStudentById.mockResolvedValue({ id: 'test', batchId: null })
      mockPrismaDelete
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined)

      const result = await bulkDeleteStudentsAction([
        'student-1',
        'student-2',
        'student-3',
      ])

      expect(result.success).toBe(true)
      expect(result.data?.deletedCount).toBe(2)
      expect(result.data?.failedDeletes).toContain('student-2')
    })
  })

  describe('getStudentDeleteWarningsAction', () => {
    it('should return warnings for student', async () => {
      mockGetStudentDeleteWarnings.mockResolvedValue({
        hasSiblings: true,
        hasAttendanceRecords: false,
      })

      const result = await getStudentDeleteWarningsAction('student-1')

      expect(result.success).toBe(true)
      expect(result.data.hasSiblings).toBe(true)
    })

    it('should return default warnings on error', async () => {
      mockGetStudentDeleteWarnings.mockRejectedValue(new Error('DB error'))

      const result = await getStudentDeleteWarningsAction('student-1')

      expect(result.success).toBe(false)
      expect(result.data.hasSiblings).toBe(false)
      expect(result.data.hasAttendanceRecords).toBe(false)
    })
  })
})

describe('Duplicate Resolution Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resolveDuplicatesAction', () => {
    it('should resolve duplicates successfully', async () => {
      mockGetStudentById
        .mockResolvedValueOnce({ id: 'keep-id', batchId: 'batch-1' })
        .mockResolvedValueOnce({ id: 'delete-1', batchId: 'batch-1' })
        .mockResolvedValueOnce({ id: 'delete-2', batchId: null })
      mockResolveDuplicateStudents.mockResolvedValue(undefined)

      const result = await resolveDuplicatesAction('keep-id', [
        'delete-1',
        'delete-2',
      ])

      expect(result.success).toBe(true)
      expect(mockResolveDuplicateStudents).toHaveBeenCalledWith(
        'keep-id',
        ['delete-1', 'delete-2'],
        false
      )
    })

    it('should reject when trying to delete the keep record', async () => {
      const result = await resolveDuplicatesAction('keep-id', [
        'keep-id',
        'other-id',
      ])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cannot delete the record you want to keep')
    })

    it('should reject empty delete list', async () => {
      const result = await resolveDuplicatesAction('keep-id', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('No duplicate records selected for deletion')
    })

    it('should reject when keep record not found', async () => {
      mockGetStudentById.mockResolvedValue(null)

      const result = await resolveDuplicatesAction('non-existent', ['delete-1'])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Student record to keep not found')
    })
  })
})

describe('Payment Link Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.app'
  })

  describe('generatePaymentLinkAction', () => {
    it('should generate payment link for valid profile', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'profile-1',
        personId: 'person-1',
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: 'FULL_TIME',
        person: {
          name: 'Test Student',
          contactPoints: [{ value: 'test@example.com', type: 'EMAIL' }],
        },
      })
      mockStripeSessionCreate.mockResolvedValue({
        id: 'sess_123',
        url: 'https://checkout.stripe.com/test',
      })

      const result = await generatePaymentLinkAction('profile-1')

      expect(result.success).toBe(true)
      expect(result.url).toBe('https://checkout.stripe.com/test')
      expect(result.amount).toBe(15000)
    })

    it('should reject profile without billing config', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'profile-1',
        personId: 'person-1',
        graduationStatus: null,
        paymentFrequency: null,
        billingType: null,
        person: {
          name: 'Test Student',
          contactPoints: [{ value: 'test@example.com' }],
        },
      })

      const result = await generatePaymentLinkAction('profile-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Billing configuration incomplete')
    })

    it('should reject exempt students', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'profile-1',
        personId: 'person-1',
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: 'EXEMPT',
        person: {
          name: 'Test Student',
          contactPoints: [{ value: 'test@example.com' }],
        },
      })

      const result = await generatePaymentLinkAction('profile-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Exempt students do not need payment')
    })

    it('should reject profile without email', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'profile-1',
        personId: 'person-1',
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: 'FULL_TIME',
        person: {
          name: 'Test Student',
          contactPoints: [],
        },
      })

      const result = await generatePaymentLinkAction('profile-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('email address is required')
    })

    it('should return error for non-existent profile', async () => {
      mockPrismaFindUnique.mockResolvedValue(null)

      const result = await generatePaymentLinkAction('non-existent')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Student profile not found')
    })
  })
})
