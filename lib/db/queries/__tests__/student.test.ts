import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockFindMany, mockFindUnique, mockFindFirst, mockCount } = vi.hoisted(
  () => ({
    mockFindMany: vi.fn(),
    mockFindUnique: vi.fn(),
    mockFindFirst: vi.fn(),
    mockCount: vi.fn(),
  })
)

const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}))

const { mockFindUniqueOrThrow } = vi.hoisted(() => ({
  mockFindUniqueOrThrow: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      findUniqueOrThrow: mockFindUniqueOrThrow,
      count: mockCount,
      deleteMany: vi.fn(),
    },
    enrollment: {
      updateMany: vi.fn(),
    },
    contactPoint: {
      create: vi.fn(),
    },
    person: {
      delete: vi.fn(),
    },
    $transaction: mockTransaction,
  },
}))

vi.mock('@/lib/utils/type-guards', () => ({
  isPrismaError: vi.fn(() => false),
}))

import {
  getStudents,
  getStudentsWithBatch,
  getStudentsWithBatchFiltered,
  getStudentById,
  getStudentByEmail,
  getStudentsByBatch,
  getUnassignedStudents,
  findDuplicateStudents,
  getStudentCompleteness,
  getStudentDeleteWarnings,
} from '../student'

describe('student queries use relationLoadStrategy: join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStudents', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockFindMany.mockResolvedValue([])

      await getStudents()

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getStudentsWithBatch', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockFindMany.mockResolvedValue([])

      await getStudentsWithBatch()

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getStudentsWithBatchFiltered', () => {
    it('should pass relationLoadStrategy join to findMany', async () => {
      mockFindMany.mockResolvedValue([])
      mockCount.mockResolvedValue(0)

      await getStudentsWithBatchFiltered({})

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getStudentById', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockFindUnique.mockResolvedValue(null)

      await getStudentById('test-id')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getStudentByEmail', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockFindFirst.mockResolvedValue(null)

      await getStudentByEmail('test@example.com')

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getStudentsByBatch', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockFindMany.mockResolvedValue([])

      await getStudentsByBatch('batch-1')

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getUnassignedStudents', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockFindMany.mockResolvedValue([])

      await getUnassignedStudents()

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('findDuplicateStudents', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockFindMany.mockResolvedValue([])

      await findDuplicateStudents()

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('resolveDuplicateStudents', () => {
    it('should pass relationLoadStrategy join to both queries inside transaction', async () => {
      const txMockFindUniqueOrThrow = vi.fn().mockResolvedValue({
        id: 'keep-1',
        program: 'MAHAD_PROGRAM',
        personId: 'person-1',
        person: { contactPoints: [] },
        assignments: [],
      })
      const txMockFindMany = vi.fn().mockResolvedValue([])
      const txMockEnrollmentUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
      const txMockProfileDeleteMany = vi.fn().mockResolvedValue({ count: 0 })

      mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
          return fn({
            programProfile: {
              findUniqueOrThrow: txMockFindUniqueOrThrow,
              findMany: txMockFindMany,
              deleteMany: txMockProfileDeleteMany,
              count: vi.fn().mockResolvedValue(0),
            },
            enrollment: {
              updateMany: txMockEnrollmentUpdateMany,
            },
            person: {
              delete: vi.fn(),
            },
          })
        }
      )

      const { resolveDuplicateStudents } = await import('../student')
      await resolveDuplicateStudents('keep-1', ['del-1'])

      expect(txMockFindUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
      expect(txMockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getStudentCompleteness', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'p1',
        gradeLevel: null,
        graduationStatus: null,
        billingType: null,
        person: {
          name: 'Test',
          dateOfBirth: null,
          contactPoints: [],
        },
        enrollments: [],
      })

      await getStudentCompleteness('p1')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getStudentDeleteWarnings', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockFindUnique.mockResolvedValue(null)

      await getStudentDeleteWarnings('test-id')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })
})
