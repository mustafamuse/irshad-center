import { vi, describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'

import { ActionError } from '@/lib/errors/action-error'

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
          if (error instanceof ActionError)
            return { serverError: (error as ActionError).message }
          return { serverError: 'Something went wrong' }
        }
      },
    }
    return client
  }
  return {
    actionClient: makeClient(),
    adminActionClient: makeClient(),
    rateLimitedActionClient: makeClient(),
  }
})

const {
  mockCreateBatch,
  mockUpdateBatch,
  mockDeleteBatch,
  mockGetBatchById,
  mockAssignStudentsToBatch,
  mockTransferStudents,
  mockGetStudentById,
  mockResolveDuplicateStudents,
  mockGetStudentDeleteWarnings,
  mockPrismaDelete,
  mockPrismaFindUnique,
  mockRevalidatePath,
  mockRevalidateTag,
  mockLoggerError,
  mockLoggerWarn,
  mockLogError,
  mockStripeSessionCreate,
  mockBillingAssignmentFindMany,
  mockBillingAssignmentFindFirst,
  mockPrismaDeleteMany,
  mockPersonUpdate,
  mockAfter,
  mockGetProfileForPaymentLink,
  mockGetBatchByName,
  mockSetProfileBillingDefaults,
} = vi.hoisted(() => ({
  mockCreateBatch: vi.fn(),
  mockUpdateBatch: vi.fn(),
  mockDeleteBatch: vi.fn(),
  mockGetBatchById: vi.fn(),
  mockGetBatchByName: vi.fn(),
  mockAssignStudentsToBatch: vi.fn(),
  mockTransferStudents: vi.fn(),
  mockGetStudentById: vi.fn(),
  mockResolveDuplicateStudents: vi.fn(),
  mockGetStudentDeleteWarnings: vi.fn(),
  mockPrismaDelete: vi.fn(),
  mockPrismaDeleteMany: vi.fn(),
  mockPrismaFindUnique: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLogError: vi.fn(),
  mockStripeSessionCreate: vi.fn(),
  mockBillingAssignmentFindMany: vi.fn(),
  mockBillingAssignmentFindFirst: vi.fn(),
  mockPersonUpdate: vi.fn(),
  mockAfter: vi.fn((fn: () => void) => fn()),
  mockGetProfileForPaymentLink: vi.fn(),
  mockSetProfileBillingDefaults: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}))

vi.mock('next/server', () => ({
  after: (fn: () => void) => mockAfter(fn),
}))

vi.mock('@/lib/db', () => ({
  prisma: (() => {
    const client: Record<string, unknown> = {
      programProfile: {
        delete: (...args: unknown[]) => mockPrismaDelete(...args),
        deleteMany: (...args: unknown[]) => mockPrismaDeleteMany(...args),
        findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
      },
      billingAssignment: {
        findMany: (...args: unknown[]) =>
          mockBillingAssignmentFindMany(...args),
        findFirst: (...args: unknown[]) =>
          mockBillingAssignmentFindFirst(...args),
      },
      person: {
        update: (...args: unknown[]) => mockPersonUpdate(...args),
      },
    }
    client.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(client)
    return client
  })(),
}))

vi.mock('@/lib/db/queries/batch', () => ({
  createBatch: (...args: unknown[]) => mockCreateBatch(...args),
  updateBatch: (...args: unknown[]) => mockUpdateBatch(...args),
  deleteBatch: (...args: unknown[]) => mockDeleteBatch(...args),
  getBatchById: (...args: unknown[]) => mockGetBatchById(...args),
  getBatchByName: (...args: unknown[]) => mockGetBatchByName(...args),
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
  getProfileForPaymentLink: (...args: unknown[]) =>
    mockGetProfileForPaymentLink(...args),
  setProfileBillingDefaults: (...args: unknown[]) =>
    mockSetProfileBillingDefaults(...args),
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: vi.fn(() => ({
    error: mockLoggerError,
    warn: mockLoggerWarn,
    info: vi.fn(),
    debug: vi.fn(),
  })),
  createServiceLogger: vi.fn(() => ({
    error: mockLoggerError,
    warn: mockLoggerWarn,
    info: vi.fn(),
    debug: vi.fn(),
  })),
  logError: (...args: unknown[]) => mockLogError(...args),
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
  updateBatchAction,
  deleteBatchAction,
  assignStudentsAction,
  transferStudentsAction,
  resolveDuplicatesAction,
  deleteStudentAction,
  bulkDeleteStudentsAction,
  getStudentDeleteWarningsAction,
  generatePaymentLinkAction,
  generatePaymentLinkWithDefaultsAction,
  updateStudentAction,
} from '../index'

const VALID_BATCH_ID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_BATCH_ID_2 = '550e8400-e29b-41d4-a716-446655440001'
const VALID_STUDENT_ID = '550e8400-e29b-41d4-a716-446655440002'
const VALID_STUDENT_ID_2 = '550e8400-e29b-41d4-a716-446655440003'
const VALID_STUDENT_ID_3 = '550e8400-e29b-41d4-a716-446655440004'
const VALID_PROFILE_ID = '550e8400-e29b-41d4-a716-446655440005'

describe('Batch Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createBatchAction', () => {
    it('should create a batch with valid data', async () => {
      const mockBatch = { id: 'batch-1', name: 'Test Cohort' }
      mockGetBatchByName.mockResolvedValue(null)
      mockCreateBatch.mockResolvedValue(mockBatch)

      const result = await createBatchAction({
        name: 'Test Cohort',
        startDate: new Date('2024-01-15'),
      })

      expect(result?.data).toEqual(mockBatch)
      expect(mockCreateBatch).toHaveBeenCalledWith({
        name: 'Test Cohort',
        startDate: expect.any(Date),
        endDate: null,
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/mahad')
    })

    it('should return validation error for empty name', async () => {
      const result = await createBatchAction({ name: '' })

      expect(result?.validationErrors).toBeDefined()
    })

    it('should handle duplicate name error', async () => {
      mockGetBatchByName.mockResolvedValue({
        id: 'other-batch',
        name: 'Existing Cohort',
        studentCount: 0,
      })

      const result = await createBatchAction({ name: 'Existing Cohort' })

      expect(result?.serverError).toContain('already exists')
    })
  })

  describe('deleteBatchAction', () => {
    it('should delete an empty batch', async () => {
      mockGetBatchById.mockResolvedValue({
        id: VALID_BATCH_ID,
        name: 'Empty Cohort',
        studentCount: 0,
      })
      mockDeleteBatch.mockResolvedValue(undefined)

      const result = await deleteBatchAction({ id: VALID_BATCH_ID })

      expect(result?.serverError).toBeUndefined()
      expect(mockDeleteBatch).toHaveBeenCalledWith(VALID_BATCH_ID)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/mahad')
    })

    it('should reject deletion of batch with students', async () => {
      mockGetBatchById.mockResolvedValue({
        id: VALID_BATCH_ID,
        name: 'Active Cohort',
        studentCount: 5,
      })

      const result = await deleteBatchAction({ id: VALID_BATCH_ID })

      expect(result?.serverError).toContain('Cannot delete cohort')
      expect(result?.serverError).toContain('5 students enrolled')
      expect(mockDeleteBatch).not.toHaveBeenCalled()
    })

    it('should return error for non-existent batch', async () => {
      mockGetBatchById.mockResolvedValue(null)

      const result = await deleteBatchAction({ id: VALID_BATCH_ID })

      expect(result?.serverError).toBe('Cohort not found')
    })
  })

  describe('updateBatchAction', () => {
    it('should update a batch with valid data', async () => {
      mockGetBatchById.mockResolvedValue({
        id: VALID_BATCH_ID,
        name: 'Original Name',
        startDate: null,
        endDate: null,
      })
      mockGetBatchByName.mockResolvedValue(null)
      const mockUpdatedBatch = {
        id: VALID_BATCH_ID,
        name: 'Updated Name',
        startDate: new Date('2024-01-15'),
        endDate: null,
      }
      mockUpdateBatch.mockResolvedValue(mockUpdatedBatch)

      const result = await updateBatchAction({
        id: VALID_BATCH_ID,
        name: 'Updated Name',
        startDate: new Date('2024-01-15'),
      })

      expect(result?.data).toEqual(mockUpdatedBatch)
      expect(mockUpdateBatch).toHaveBeenCalledWith(VALID_BATCH_ID, {
        name: 'Updated Name',
        startDate: expect.any(Date),
        endDate: undefined,
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/mahad')
    })

    it('should update only provided fields (partial update)', async () => {
      mockGetBatchById.mockResolvedValue({
        id: VALID_BATCH_ID,
        name: 'Original Name',
      })
      mockGetBatchByName.mockResolvedValue(null)
      const mockUpdatedBatch = { id: VALID_BATCH_ID, name: 'New Name' }
      mockUpdateBatch.mockResolvedValue(mockUpdatedBatch)

      const result = await updateBatchAction({
        id: VALID_BATCH_ID,
        name: 'New Name',
      })

      expect(result?.data).toEqual(mockUpdatedBatch)
      expect(mockUpdateBatch).toHaveBeenCalledWith(VALID_BATCH_ID, {
        name: 'New Name',
        startDate: undefined,
        endDate: undefined,
      })
    })

    it('should return error for non-existent batch', async () => {
      mockGetBatchById.mockResolvedValue(null)

      const result = await updateBatchAction({
        id: VALID_BATCH_ID,
        name: 'Test',
      })

      expect(result?.serverError).toBe('Cohort not found')
      expect(mockUpdateBatch).not.toHaveBeenCalled()
    })

    it('should handle duplicate name error', async () => {
      mockGetBatchById.mockResolvedValue({
        id: VALID_BATCH_ID,
        name: 'Original Name',
      })
      mockGetBatchByName.mockResolvedValue({
        id: 'other-batch',
        name: 'Existing Cohort',
        studentCount: 0,
      })

      const result = await updateBatchAction({
        id: VALID_BATCH_ID,
        name: 'Existing Cohort',
      })

      expect(result?.serverError).toContain('already exists')
    })
  })

  describe('assignStudentsAction', () => {
    it('should assign students to a batch', async () => {
      mockGetBatchById.mockResolvedValue({ id: VALID_BATCH_ID, name: 'Target' })
      mockAssignStudentsToBatch.mockResolvedValue({
        assignedCount: 3,
        failedAssignments: [],
      })

      const result = await assignStudentsAction({
        batchId: VALID_BATCH_ID,
        studentIds: [VALID_STUDENT_ID, VALID_STUDENT_ID_2, VALID_STUDENT_ID_3],
      })

      expect(result?.data?.assignedCount).toBe(3)
      expect(result?.data?.failedAssignments).toEqual([])
    })

    it('should return error for non-existent batch', async () => {
      mockGetBatchById.mockResolvedValue(null)

      const result = await assignStudentsAction({
        batchId: VALID_BATCH_ID,
        studentIds: [VALID_STUDENT_ID],
      })

      expect(result?.serverError).toBe('Cohort not found')
    })

    it('should return validation error for empty student list', async () => {
      const result = await assignStudentsAction({
        batchId: VALID_BATCH_ID,
        studentIds: [],
      })

      expect(result?.validationErrors).toBeDefined()
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
        errors: [],
      })

      const result = await transferStudentsAction({
        fromBatchId: VALID_BATCH_ID,
        toBatchId: VALID_BATCH_ID_2,
        studentIds: [VALID_STUDENT_ID, VALID_STUDENT_ID_2],
      })

      expect(result?.data?.transferredCount).toBe(2)
    })

    it('should reject transfer to same batch', async () => {
      mockGetBatchById.mockResolvedValue({
        id: VALID_BATCH_ID,
        name: 'Same Cohort',
      })

      const result = await transferStudentsAction({
        fromBatchId: VALID_BATCH_ID,
        toBatchId: VALID_BATCH_ID,
        studentIds: [VALID_STUDENT_ID],
      })

      expect(result?.serverError).toContain(
        'Cannot transfer within the same cohort'
      )
    })

    it('should return error when source batch not found', async () => {
      mockGetBatchById.mockResolvedValueOnce(null)

      const result = await transferStudentsAction({
        fromBatchId: VALID_BATCH_ID,
        toBatchId: VALID_BATCH_ID_2,
        studentIds: [VALID_STUDENT_ID],
      })

      expect(result?.serverError).toBe('Source cohort not found')
    })
  })
})

describe('Student Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deleteStudentAction', () => {
    it('should delete an existing student', async () => {
      mockGetStudentById.mockResolvedValue({
        id: VALID_STUDENT_ID,
        batchId: null,
      })
      mockBillingAssignmentFindFirst.mockResolvedValue(null)
      mockPrismaDelete.mockResolvedValue(undefined)

      const result = await deleteStudentAction({ id: VALID_STUDENT_ID })

      expect(result?.serverError).toBeUndefined()
      expect(mockPrismaDelete).toHaveBeenCalledWith({
        where: { id: VALID_STUDENT_ID },
      })
    })

    it('should revalidate batch path if student has batch', async () => {
      mockGetStudentById.mockResolvedValue({
        id: VALID_STUDENT_ID,
        batchId: VALID_BATCH_ID,
      })
      mockBillingAssignmentFindFirst.mockResolvedValue(null)
      mockPrismaDelete.mockResolvedValue(undefined)

      await deleteStudentAction({ id: VALID_STUDENT_ID })

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/mahad')
    })

    it('should return error for non-existent student', async () => {
      mockGetStudentById.mockResolvedValue(null)

      const result = await deleteStudentAction({
        id: '550e8400-e29b-41d4-a716-446655449999',
      })

      expect(result?.serverError).toBe('Student not found')
    })

    it('should reject invalid UUID', async () => {
      const result = await deleteStudentAction({ id: 'not-a-uuid' })

      expect(result?.validationErrors).toBeDefined()
    })

    it('should block deletion when active subscription exists', async () => {
      mockGetStudentById.mockResolvedValue({
        id: VALID_STUDENT_ID,
        batchId: null,
      })
      mockBillingAssignmentFindFirst.mockResolvedValue({
        id: 'ba-1',
        programProfileId: VALID_STUDENT_ID,
        isActive: true,
      })

      const result = await deleteStudentAction({ id: VALID_STUDENT_ID })

      expect(result?.serverError).toContain('active billing subscription')
      expect(mockPrismaDelete).not.toHaveBeenCalled()
      expect(mockBillingAssignmentFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            programProfileId: VALID_STUDENT_ID,
            isActive: true,
            subscription: expect.objectContaining({
              status: expect.objectContaining({
                in: expect.any(Array),
              }),
            }),
          }),
        })
      )
    })

    it('should allow deletion when subscription is canceled', async () => {
      mockGetStudentById.mockResolvedValue({
        id: VALID_STUDENT_ID,
        batchId: null,
      })
      mockBillingAssignmentFindFirst.mockResolvedValue(null)
      mockPrismaDelete.mockResolvedValue(undefined)

      const result = await deleteStudentAction({ id: VALID_STUDENT_ID })

      expect(result?.serverError).toBeUndefined()
      expect(mockPrismaDelete).toHaveBeenCalled()
    })
  })

  describe('bulkDeleteStudentsAction', () => {
    it('should delete multiple students', async () => {
      mockBillingAssignmentFindMany.mockResolvedValue([])
      mockPrismaDeleteMany.mockResolvedValue({ count: 3 })

      const result = await bulkDeleteStudentsAction({
        studentIds: [VALID_STUDENT_ID, VALID_STUDENT_ID_2, VALID_STUDENT_ID_3],
      })

      expect(result?.data?.deletedCount).toBe(3)
      expect(result?.data?.blockedIds).toEqual([])
    })

    it('should return error for empty student list', async () => {
      const result = await bulkDeleteStudentsAction({ studentIds: [] })

      expect(result?.validationErrors).toBeDefined()
    })

    it('should reject invalid UUIDs', async () => {
      const result = await bulkDeleteStudentsAction({
        studentIds: ['not-a-uuid', 'also-bad'],
      })

      expect(result?.validationErrors).toBeDefined()
    })

    it('should skip students with active subscriptions', async () => {
      mockBillingAssignmentFindMany.mockResolvedValue([
        { programProfileId: VALID_STUDENT_ID_2 },
      ])
      mockPrismaDeleteMany.mockResolvedValue({ count: 2 })

      const result = await bulkDeleteStudentsAction({
        studentIds: [VALID_STUDENT_ID, VALID_STUDENT_ID_2, VALID_STUDENT_ID_3],
      })

      expect(result?.data?.deletedCount).toBe(2)
      expect(result?.data?.blockedIds).toEqual([VALID_STUDENT_ID_2])
    })

    it('should return error when all students are blocked', async () => {
      mockBillingAssignmentFindMany.mockResolvedValue([
        { programProfileId: VALID_STUDENT_ID },
        { programProfileId: VALID_STUDENT_ID_2 },
      ])

      const result = await bulkDeleteStudentsAction({
        studentIds: [VALID_STUDENT_ID, VALID_STUDENT_ID_2],
      })

      expect(result?.serverError).toContain('active subscriptions')
      expect(mockRevalidateTag).not.toHaveBeenCalled()
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('should return error when deleteMany fails', async () => {
      mockBillingAssignmentFindMany.mockResolvedValue([])
      mockPrismaDeleteMany.mockRejectedValue(new Error('DB error'))

      const result = await bulkDeleteStudentsAction({
        studentIds: [VALID_STUDENT_ID, VALID_STUDENT_ID_2],
      })

      expect(result?.serverError).toBeDefined()
    })
  })

  describe('getStudentDeleteWarningsAction', () => {
    it('should return warnings for student', async () => {
      mockGetStudentDeleteWarnings.mockResolvedValue({
        hasSiblings: true,
        hasAttendanceRecords: false,
        hasActiveSubscription: false,
        hasPaymentHistory: false,
      })

      const result = await getStudentDeleteWarningsAction({
        id: VALID_STUDENT_ID,
      })

      expect(result?.data?.hasSiblings).toBe(true)
    })

    it('should return error on failure', async () => {
      mockGetStudentDeleteWarnings.mockRejectedValue(new Error('DB error'))

      const result = await getStudentDeleteWarningsAction({
        id: VALID_STUDENT_ID,
      })

      expect(result?.serverError).toBeDefined()
    })

    it('should reject invalid UUID', async () => {
      const result = await getStudentDeleteWarningsAction({ id: 'not-a-uuid' })

      expect(result?.validationErrors).toBeDefined()
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
        .mockResolvedValueOnce({
          id: VALID_STUDENT_ID,
          batchId: VALID_BATCH_ID,
        })
        .mockResolvedValueOnce({
          id: VALID_STUDENT_ID_2,
          batchId: VALID_BATCH_ID,
        })
        .mockResolvedValueOnce({ id: VALID_STUDENT_ID_3, batchId: null })
      mockResolveDuplicateStudents.mockResolvedValue(undefined)

      const result = await resolveDuplicatesAction({
        keepId: VALID_STUDENT_ID,
        deleteIds: [VALID_STUDENT_ID_2, VALID_STUDENT_ID_3],
      })

      expect(result?.serverError).toBeUndefined()
      expect(mockResolveDuplicateStudents).toHaveBeenCalledWith(
        VALID_STUDENT_ID,
        [VALID_STUDENT_ID_2, VALID_STUDENT_ID_3],
        false
      )
    })

    it('should reject when trying to delete the keep record', async () => {
      const result = await resolveDuplicatesAction({
        keepId: VALID_STUDENT_ID,
        deleteIds: [VALID_STUDENT_ID, VALID_STUDENT_ID_2],
      })

      expect(result?.serverError).toBe(
        'Cannot delete the record you want to keep'
      )
    })

    it('should reject empty delete list', async () => {
      const result = await resolveDuplicatesAction({
        keepId: VALID_STUDENT_ID,
        deleteIds: [],
      })

      expect(result?.validationErrors).toBeDefined()
    })

    it('should reject invalid UUIDs', async () => {
      const result = await resolveDuplicatesAction({
        keepId: 'not-a-uuid',
        deleteIds: ['also-bad'],
      })

      expect(result?.validationErrors).toBeDefined()
    })

    it('should reject invalid delete IDs', async () => {
      const result = await resolveDuplicatesAction({
        keepId: VALID_STUDENT_ID,
        deleteIds: ['not-a-uuid'],
      })

      expect(result?.validationErrors).toBeDefined()
    })

    it('should reject when keep record not found', async () => {
      mockGetStudentById.mockResolvedValue(null)

      const nonExistentId = '550e8400-e29b-41d4-a716-446655449999'
      const deleteId = '550e8400-e29b-41d4-a716-446655449998'

      const result = await resolveDuplicatesAction({
        keepId: nonExistentId,
        deleteIds: [deleteId],
      })

      expect(result?.serverError).toBe('Student record to keep not found')
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
      mockGetProfileForPaymentLink.mockResolvedValue({
        id: 'profile-1',
        personId: 'person-1',
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: 'FULL_TIME',
        person: {
          name: 'Test Student',
          email: 'test@example.com',
          phone: null,
        },
      })
      mockStripeSessionCreate.mockResolvedValue({
        id: 'sess_123',
        url: 'https://checkout.stripe.com/test',
      })

      const result = await generatePaymentLinkAction({
        profileId: VALID_STUDENT_ID,
      })

      expect(result?.data?.url).toBe('https://checkout.stripe.com/test')
      expect(result?.data?.amount).toBe(15000)
    })

    it('should reject profile without billing config', async () => {
      mockGetProfileForPaymentLink.mockResolvedValue({
        id: 'profile-1',
        personId: 'person-1',
        graduationStatus: null,
        paymentFrequency: null,
        billingType: null,
        person: {
          name: 'Test Student',
          email: 'test@example.com',
          phone: null,
        },
      })

      const result = await generatePaymentLinkAction({
        profileId: VALID_STUDENT_ID,
      })

      expect(result?.serverError).toContain('Billing configuration incomplete')
    })

    it('should reject exempt students', async () => {
      mockGetProfileForPaymentLink.mockResolvedValue({
        id: 'profile-1',
        personId: 'person-1',
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: 'EXEMPT',
        person: {
          name: 'Test Student',
          email: 'test@example.com',
          phone: null,
        },
      })

      const result = await generatePaymentLinkAction({
        profileId: VALID_STUDENT_ID,
      })

      expect(result?.serverError).toContain(
        'Exempt students do not need payment'
      )
    })

    it('should reject profile without email', async () => {
      mockGetProfileForPaymentLink.mockResolvedValue({
        id: 'profile-1',
        personId: 'person-1',
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: 'FULL_TIME',
        person: {
          name: 'Test Student',
          email: null,
          phone: null,
        },
      })

      const result = await generatePaymentLinkAction({
        profileId: VALID_STUDENT_ID,
      })

      expect(result?.serverError).toContain('email address is required')
    })

    it('should return error for non-existent profile', async () => {
      mockGetProfileForPaymentLink.mockResolvedValue(null)
      const nonExistentId = '550e8400-e29b-41d4-a716-446655449999'

      const result = await generatePaymentLinkAction({
        profileId: nonExistentId,
      })

      expect(result?.serverError).toBe('Student profile not found')
    })

    it('should reject invalid UUID', async () => {
      const result = await generatePaymentLinkAction({
        profileId: 'not-a-uuid',
      })

      expect(result?.validationErrors).toBeDefined()
    })

    describe('payment method types', () => {
      const mockProfile = {
        id: 'profile-1',
        personId: 'person-1',
        graduationStatus: 'NON_GRADUATE',
        paymentFrequency: 'MONTHLY',
        billingType: 'FULL_TIME',
        person: {
          name: 'Test Student',
          email: 'test@example.com',
          phone: null,
        },
      }

      beforeEach(() => {
        mockGetProfileForPaymentLink.mockResolvedValue(mockProfile)
        mockStripeSessionCreate.mockResolvedValue({
          id: 'sess_123',
          url: 'https://checkout.stripe.com/test',
        })
      })

      it('should include card and ACH when feature flag is enabled', async () => {
        vi.stubEnv('MAHAD_CARD_PAYMENTS_ENABLED', 'true')

        await generatePaymentLinkAction({ profileId: VALID_STUDENT_ID })

        expect(mockStripeSessionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            payment_method_types: ['card', 'us_bank_account'],
          })
        )
      })

      it('should only include ACH when feature flag is disabled', async () => {
        vi.stubEnv('MAHAD_CARD_PAYMENTS_ENABLED', 'false')

        await generatePaymentLinkAction({ profileId: VALID_STUDENT_ID })

        expect(mockStripeSessionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            payment_method_types: ['us_bank_account'],
          })
        )
      })

      it('should only include ACH when feature flag is not set', async () => {
        vi.stubEnv('MAHAD_CARD_PAYMENTS_ENABLED', '')

        await generatePaymentLinkAction({ profileId: VALID_STUDENT_ID })

        expect(mockStripeSessionCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            payment_method_types: ['us_bank_account'],
          })
        )
      })
    })
  })
})

describe('Student Update Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateStudentAction', () => {
    const VALID_PERSON_ID = '550e8400-e29b-41d4-a716-446655440006'

    const mockProfile = {
      id: VALID_PROFILE_ID,
      personId: VALID_PERSON_ID,
      person: {
        email: null,
        phone: '6125551234',
      },
      enrollments: [{ id: 'enroll-1' }],
    }

    beforeEach(() => {
      mockGetStudentById.mockResolvedValue({ id: VALID_PROFILE_ID })
      mockPrismaFindUnique.mockResolvedValue(mockProfile)
    })

    it('should normalize phone before storing (612-555-1234 → 6125551234)', async () => {
      const result = await updateStudentAction({
        id: VALID_PROFILE_ID,
        phone: '612-555-1234',
      })

      expect(result?.serverError).toBeUndefined()
      expect(mockPersonUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: VALID_PERSON_ID },
          data: expect.objectContaining({ phone: '6125551234' }),
        })
      )
    })

    it('should reject invalid phone number', async () => {
      const result = await updateStudentAction({
        id: VALID_PROFILE_ID,
        phone: '123',
      })

      expect(result?.validationErrors ?? result?.serverError).toBeDefined()
    })

    it('should strip NANP country code (+16125551234 → 6125551234)', async () => {
      const result = await updateStudentAction({
        id: VALID_PROFILE_ID,
        phone: '+1 (612) 555-1234',
      })

      expect(result?.serverError).toBeUndefined()
      expect(mockPersonUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '6125551234' }),
        })
      )
    })

    it('should set phone on Person when none exists', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        ...mockProfile,
        person: { email: null, phone: null },
      })

      const result = await updateStudentAction({
        id: VALID_PROFILE_ID,
        phone: '612-555-1234',
      })

      expect(result?.serverError).toBeUndefined()
      expect(mockPersonUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '6125551234' }),
        })
      )
    })

    it('should normalize email before storing', async () => {
      const result = await updateStudentAction({
        id: VALID_PROFILE_ID,
        email: 'Test@Example.COM',
      })

      expect(result?.serverError).toBeUndefined()
      expect(mockPersonUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: VALID_PERSON_ID },
          data: expect.objectContaining({ email: 'test@example.com' }),
        })
      )
    })

    it('should handle P2002 duplicate email', async () => {
      const p2002Error = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
        meta: { target: ['email'] },
      })
      mockPersonUpdate.mockRejectedValue(p2002Error)

      const result = await updateStudentAction({
        id: VALID_PROFILE_ID,
        email: 'duplicate@example.com',
      })

      expect(result?.serverError).toContain('email or phone')
    })
  })
})

describe('generatePaymentLinkWithDefaultsAction', () => {
  beforeEach(() => {
    mockSetProfileBillingDefaults.mockResolvedValue(true)
  })

  it('should set billing defaults then return payment link', async () => {
    mockGetProfileForPaymentLink.mockResolvedValue({
      id: VALID_PROFILE_ID,
      personId: 'person-1',
      graduationStatus: 'NON_GRADUATE',
      paymentFrequency: 'MONTHLY',
      billingType: 'FULL_TIME',
      person: {
        name: 'Test Student',
        email: 'test@example.com',
        phone: null,
      },
    })
    mockStripeSessionCreate.mockResolvedValue({
      id: 'sess_defaults',
      url: 'https://checkout.stripe.com/defaults-test',
    })

    const result = await generatePaymentLinkWithDefaultsAction({
      profileId: VALID_PROFILE_ID,
    })

    expect(result?.data?.url).toBe('https://checkout.stripe.com/defaults-test')
    expect(result?.data?.amount).toBe(15000)
    expect(mockSetProfileBillingDefaults).toHaveBeenCalledWith(
      VALID_PROFILE_ID,
      expect.objectContaining({ graduationStatus: expect.any(String) })
    )
  })

  it('should return not found error when profile does not exist', async () => {
    mockSetProfileBillingDefaults.mockResolvedValueOnce(false)

    const result = await generatePaymentLinkWithDefaultsAction({
      profileId: VALID_PROFILE_ID,
    })

    expect(result?.serverError).toBe('Student profile not found')
  })
})
