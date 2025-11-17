import { EducationLevel, GradeLevel, SubscriptionStatus } from '@prisma/client'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'

import { prisma } from '@/lib/db'

import { getStudentsWithBatchFiltered } from '../student'

/**
 * Integration tests for getStudentsWithBatchFiltered
 *
 * NOTE: These tests require a test database to run.
 * Run with: npm test -- student-filtered.test.ts
 *
 * To run these tests:
 * 1. Set DATABASE_URL to test database in .env.test
 * 2. Run migrations on test database
 * 3. Execute: npm test
 */

describe('getStudentsWithBatchFiltered - Integration Tests', () => {
  let testBatchId: string
  let testStudentIds: string[] = []

  beforeAll(async () => {
    // Create test batch
    const batch = await prisma.batch.create({
      data: {
        name: 'Test Batch for Filtering',
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      },
    })
    testBatchId = batch.id

    // Create test students with various attributes
    const students = await Promise.all([
      prisma.student.create({
        data: {
          name: 'John Doe',
          email: 'john.doe@test.com',
          phone: '1234567890',
          status: 'enrolled',
          subscriptionStatus: SubscriptionStatus.active,
          educationLevel: EducationLevel.HIGH_SCHOOL,
          gradeLevel: GradeLevel.GRADE_12,
          batchId: testBatchId,
        },
      }),
      prisma.student.create({
        data: {
          name: 'Jane Smith',
          email: 'jane.smith@test.com',
          phone: '0987654321',
          status: 'registered',
          subscriptionStatus: SubscriptionStatus.past_due,
          educationLevel: EducationLevel.MIDDLE_SCHOOL,
          gradeLevel: GradeLevel.GRADE_8,
          batchId: testBatchId,
        },
      }),
      prisma.student.create({
        data: {
          name: 'Bob Johnson',
          email: 'bob.johnson@test.com',
          status: 'enrolled',
          subscriptionStatus: SubscriptionStatus.active,
          educationLevel: EducationLevel.HIGH_SCHOOL,
          gradeLevel: GradeLevel.GRADE_11,
          // No batch assigned
        },
      }),
      prisma.student.create({
        data: {
          name: 'Alice Williams',
          email: 'alice.williams@test.com',
          status: 'on_leave',
          subscriptionStatus: SubscriptionStatus.canceled,
          educationLevel: EducationLevel.ELEMENTARY,
          gradeLevel: GradeLevel.GRADE_5,
          batchId: testBatchId,
        },
      }),
    ])

    testStudentIds = students.map((s) => s.id)
  })

  afterAll(async () => {
    // Cleanup test data
    await prisma.student.deleteMany({
      where: { id: { in: testStudentIds } },
    })
    await prisma.batch.delete({
      where: { id: testBatchId },
    })
    await prisma.$disconnect()
  })

  describe('pagination', () => {
    it('should return correct page of results', async () => {
      const result = await getStudentsWithBatchFiltered({
        page: 1,
        limit: 2,
      })

      expect(result.students).toHaveLength(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(2)
    })

    it('should calculate total pages correctly', async () => {
      const result = await getStudentsWithBatchFiltered({
        limit: 2,
      })

      expect(result.totalPages).toBeGreaterThan(0)
      expect(result.totalPages).toBe(Math.ceil(result.totalCount / 2))
    })

    it('should return empty array for page beyond total pages', async () => {
      const result = await getStudentsWithBatchFiltered({
        page: 9999,
        limit: 10,
      })

      expect(result.students).toHaveLength(0)
      expect(result.page).toBe(9999)
    })
  })

  describe('search filtering', () => {
    it('should filter by name (case-insensitive)', async () => {
      const result = await getStudentsWithBatchFiltered({
        search: 'john',
      })

      expect(result.students.some((s) => s.name.includes('John'))).toBe(true)
      expect(result.totalCount).toBeGreaterThan(0)
    })

    it('should filter by email', async () => {
      const result = await getStudentsWithBatchFiltered({
        search: 'jane.smith',
      })

      expect(
        result.students.some((s) => s.email === 'jane.smith@test.com')
      ).toBe(true)
    })

    it('should filter by phone', async () => {
      const result = await getStudentsWithBatchFiltered({
        search: '1234567890',
      })

      expect(result.students.some((s) => s.phone === '1234567890')).toBe(true)
    })

    it('should return empty results for non-matching search', async () => {
      const result = await getStudentsWithBatchFiltered({
        search: 'NonExistentStudent12345',
      })

      expect(result.students).toHaveLength(0)
      expect(result.totalCount).toBe(0)
    })
  })

  describe('batch filtering', () => {
    it('should filter by single batch ID', async () => {
      const result = await getStudentsWithBatchFiltered({
        batchIds: [testBatchId],
        includeUnassigned: false,
      })

      expect(result.students.every((s) => s.batchId === testBatchId)).toBe(true)
    })

    it('should include unassigned when flag is true', async () => {
      const result = await getStudentsWithBatchFiltered({
        batchIds: [testBatchId],
        includeUnassigned: true,
      })

      const hasUnassigned = result.students.some((s) => s.batchId === null)
      const hasBatch = result.students.some((s) => s.batchId === testBatchId)

      expect(hasUnassigned || hasBatch).toBe(true)
    })

    it('should filter by multiple batch IDs', async () => {
      // This test assumes multiple batches exist
      const result = await getStudentsWithBatchFiltered({
        batchIds: [testBatchId, 'another-batch-id'],
        includeUnassigned: false,
      })

      expect(
        result.students.every(
          (s) => s.batchId === testBatchId || s.batchId === 'another-batch-id'
        )
      ).toBe(true)
    })
  })

  describe('status filtering', () => {
    it('should filter by single status', async () => {
      const result = await getStudentsWithBatchFiltered({
        statuses: ['enrolled'],
      })

      expect(result.students.every((s) => s.status === 'enrolled')).toBe(true)
      expect(result.totalCount).toBeGreaterThan(0)
    })

    it('should filter by multiple statuses', async () => {
      const result = await getStudentsWithBatchFiltered({
        statuses: ['enrolled', 'registered'],
      })

      expect(
        result.students.every(
          (s) => s.status === 'enrolled' || s.status === 'registered'
        )
      ).toBe(true)
    })

    it('should exclude withdrawn students by default', async () => {
      const result = await getStudentsWithBatchFiltered({})

      expect(result.students.every((s) => s.status !== 'withdrawn')).toBe(true)
    })
  })

  describe('subscription status filtering', () => {
    it('should filter by subscription status', async () => {
      const result = await getStudentsWithBatchFiltered({
        subscriptionStatuses: [SubscriptionStatus.active],
      })

      expect(
        result.students.every(
          (s) => s.subscriptionStatus === SubscriptionStatus.active
        )
      ).toBe(true)
    })

    it('should filter by multiple subscription statuses', async () => {
      const result = await getStudentsWithBatchFiltered({
        subscriptionStatuses: [
          SubscriptionStatus.active,
          SubscriptionStatus.past_due,
        ],
      })

      expect(
        result.students.every(
          (s) =>
            s.subscriptionStatus === SubscriptionStatus.active ||
            s.subscriptionStatus === SubscriptionStatus.past_due
        )
      ).toBe(true)
    })
  })

  describe('education and grade level filtering', () => {
    it('should filter by education level', async () => {
      const result = await getStudentsWithBatchFiltered({
        educationLevels: [EducationLevel.HIGH_SCHOOL],
      })

      expect(
        result.students.every(
          (s) => s.educationLevel === EducationLevel.HIGH_SCHOOL
        )
      ).toBe(true)
    })

    it('should filter by grade level', async () => {
      const result = await getStudentsWithBatchFiltered({
        gradeLevels: [GradeLevel.GRADE_12],
      })

      expect(
        result.students.every((s) => s.gradeLevel === GradeLevel.GRADE_12)
      ).toBe(true)
    })
  })

  describe('combined filters', () => {
    it('should apply multiple filters with AND logic', async () => {
      const result = await getStudentsWithBatchFiltered({
        batchIds: [testBatchId],
        statuses: ['enrolled'],
        subscriptionStatuses: [SubscriptionStatus.active],
        includeUnassigned: false,
      })

      expect(
        result.students.every(
          (s) =>
            s.batchId === testBatchId &&
            s.status === 'enrolled' &&
            s.subscriptionStatus === SubscriptionStatus.active
        )
      ).toBe(true)
    })

    it('should combine search with batch filter correctly', async () => {
      const result = await getStudentsWithBatchFiltered({
        search: 'john',
        batchIds: [testBatchId],
        includeUnassigned: false,
      })

      expect(
        result.students.every(
          (s) =>
            s.name.toLowerCase().includes('john') && s.batchId === testBatchId
        )
      ).toBe(true)
    })

    it('should return empty when filters have no matches', async () => {
      const result = await getStudentsWithBatchFiltered({
        search: 'NonExistent',
        statuses: ['enrolled'],
        subscriptionStatuses: [SubscriptionStatus.active],
      })

      expect(result.students).toHaveLength(0)
      expect(result.totalCount).toBe(0)
    })
  })

  describe('sibling data', () => {
    it('should include sibling information', async () => {
      // Create test sibling group
      const siblingGroup = await prisma.sibling.create({
        data: {},
      })

      const sibling1 = await prisma.student.create({
        data: {
          name: 'Sibling One',
          email: 'sibling1@test.com',
          status: 'enrolled',
          siblingGroupId: siblingGroup.id,
        },
      })

      const sibling2 = await prisma.student.create({
        data: {
          name: 'Sibling Two',
          email: 'sibling2@test.com',
          status: 'enrolled',
          siblingGroupId: siblingGroup.id,
        },
      })

      const result = await getStudentsWithBatchFiltered({
        search: 'Sibling',
      })

      const student = result.students.find((s) => s.id === sibling1.id)
      expect(student?.Sibling).toBeDefined()
      expect(student?.Sibling?.Student).toBeDefined()
      // Should not include self in sibling list
      expect(student?.Sibling?.Student.every((s) => s.id !== sibling1.id)).toBe(
        true
      )

      // Cleanup
      await prisma.student.deleteMany({
        where: { id: { in: [sibling1.id, sibling2.id] } },
      })
      await prisma.sibling.delete({
        where: { id: siblingGroup.id },
      })
    })
  })

  describe('performance', () => {
    it('should return results within reasonable time', async () => {
      const start = Date.now()

      await getStudentsWithBatchFiltered({
        search: 'test',
        statuses: ['enrolled', 'registered'],
        limit: 50,
      })

      const duration = Date.now() - start

      // Query should complete in under 1 second
      expect(duration).toBeLessThan(1000)
    })
  })
})
