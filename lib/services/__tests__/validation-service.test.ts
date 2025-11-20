/**
 * Validation Service Tests
 * 
 * Tests for all validation functions in the validation service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Prisma BEFORE importing validation service
vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findUnique: vi.fn(),
    },
    teacher: {
      findUnique: vi.fn(),
    },
    teacherAssignment: {
      findFirst: vi.fn(),
    },
    enrollment: {
      findMany: vi.fn(),
    },
    batch: {
      findUnique: vi.fn(),
    },
    person: {
      findUnique: vi.fn(),
    },
    guardianRelationship: {
      findFirst: vi.fn(),
    },
    siblingRelationship: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    billingAssignment: {
      findMany: vi.fn(),
    },
  },
}))

import { ValidationError } from '../validation-service'
import {
  validateTeacherAssignment,
  validateEnrollment,
  validateGuardianRelationship,
  validateSiblingRelationship,
  validateBillingAssignment,
  validateTeacherCreation,
} from '../validation-service'
import { prisma } from '@/lib/db'

describe('validateTeacherAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass validation for Dugsi program profile', async () => {
    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI_PROGRAM',
      personId: 'person-1',
    } as any)

    vi.mocked(prisma.teacher.findUnique).mockResolvedValue({
      id: 'teacher-1',
    } as any)

    vi.mocked(prisma.teacherAssignment.findFirst).mockResolvedValue(null)

    await expect(
      validateTeacherAssignment({
        programProfileId: 'profile-1',
        teacherId: 'teacher-1',
        shift: 'MORNING',
      })
    ).resolves.not.toThrow()
  })

  it('should reject non-Dugsi program profile', async () => {
    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      program: 'MAHAD_PROGRAM',
      personId: 'person-1',
    } as any)

    await expect(
      validateTeacherAssignment({
        programProfileId: 'profile-1',
        teacherId: 'teacher-1',
        shift: 'MORNING',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('should reject if program profile not found', async () => {
    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue(null)

    await expect(
      validateTeacherAssignment({
        programProfileId: 'profile-1',
        teacherId: 'teacher-1',
        shift: 'MORNING',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('should reject if teacher not found', async () => {
    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI_PROGRAM',
      personId: 'person-1',
    } as any)

    vi.mocked(prisma.teacher.findUnique).mockResolvedValue(null)

    await expect(
      validateTeacherAssignment({
        programProfileId: 'profile-1',
        teacherId: 'teacher-1',
        shift: 'MORNING',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('should reject duplicate active assignment for same shift', async () => {
    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI_PROGRAM',
      personId: 'person-1',
    } as any)

    vi.mocked(prisma.teacher.findUnique).mockResolvedValue({
      id: 'teacher-1',
    } as any)

    vi.mocked(prisma.teacherAssignment.findFirst).mockResolvedValue({
      id: 'assignment-1',
      isActive: true,
    } as any)

    await expect(
      validateTeacherAssignment({
        programProfileId: 'profile-1',
        teacherId: 'teacher-1',
        shift: 'MORNING',
      })
    ).rejects.toThrow(ValidationError)
  })
})

describe('validateEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-initialize batch mock after clearAllMocks
    // This ensures the mock structure persists
    if (!(prisma as any).batch) {
      (prisma as any).batch = { findUnique: vi.fn() }
    }
  })

  it('should pass validation for Dugsi enrollment without batch', async () => {
    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI_PROGRAM',
    } as any)

    await expect(
      validateEnrollment({
        programProfileId: 'profile-1',
        batchId: null,
        status: 'ENROLLED',
      })
    ).resolves.not.toThrow()
  })

  it('should reject Dugsi enrollment with batch', async () => {
    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      program: 'DUGSI_PROGRAM',
    } as any)

    await expect(
      validateEnrollment({
        programProfileId: 'profile-1',
        batchId: 'batch-1',
        status: 'ENROLLED',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('should pass validation for Mahad enrollment with batch', async () => {
    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      program: 'MAHAD_PROGRAM',
    } as any)

    // Access batch mock directly - it's defined in the vi.mock() call
    const batchFindUnique = vi.fn().mockResolvedValue({ id: 'batch-1' } as any)
    ;(prisma as any).batch = { findUnique: batchFindUnique }

    await expect(
      validateEnrollment({
        programProfileId: 'profile-1',
        batchId: 'batch-1',
        status: 'ENROLLED',
      })
    ).resolves.not.toThrow()
  })

  it('should reject if batch not found', async () => {
    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      program: 'MAHAD_PROGRAM',
    } as any)

    // Access batch mock directly - it's defined in the vi.mock() call
    const batchFindUnique = vi.fn().mockResolvedValue(null)
    ;(prisma as any).batch = { findUnique: batchFindUnique }

    await expect(
      validateEnrollment({
        programProfileId: 'profile-1',
        batchId: 'batch-1',
        status: 'ENROLLED',
      })
    ).rejects.toThrow(ValidationError)
  })
})

describe('validateGuardianRelationship', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass validation for valid guardian relationship', async () => {
    vi.mocked(prisma.person.findUnique)
      .mockResolvedValueOnce({ id: 'person-1', name: 'Parent' } as any)
      .mockResolvedValueOnce({ id: 'person-2', name: 'Child' } as any)

    vi.mocked(prisma.guardianRelationship.findFirst).mockResolvedValue(null)

    await expect(
      validateGuardianRelationship({
        guardianId: 'person-1',
        dependentId: 'person-2',
        role: 'PARENT',
      })
    ).resolves.not.toThrow()
  })

  it('should reject self-guardian relationship', async () => {
    await expect(
      validateGuardianRelationship({
        guardianId: 'person-1',
        dependentId: 'person-1',
        role: 'PARENT',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('should reject if guardian not found', async () => {
    vi.mocked(prisma.person.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'person-2', name: 'Child' } as any)

    await expect(
      validateGuardianRelationship({
        guardianId: 'person-1',
        dependentId: 'person-2',
        role: 'PARENT',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('should reject duplicate active relationship', async () => {
    vi.mocked(prisma.person.findUnique)
      .mockResolvedValueOnce({ id: 'person-1', name: 'Parent' } as any)
      .mockResolvedValueOnce({ id: 'person-2', name: 'Child' } as any)

    vi.mocked(prisma.guardianRelationship.findFirst).mockResolvedValue({
      id: 'relationship-1',
      isActive: true,
    } as any)

    await expect(
      validateGuardianRelationship({
        guardianId: 'person-1',
        dependentId: 'person-2',
        role: 'PARENT',
      })
    ).rejects.toThrow(ValidationError)
  })
})

describe('validateSiblingRelationship', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass validation for valid sibling relationship', async () => {
    vi.mocked(prisma.person.findUnique)
      .mockResolvedValueOnce({ id: 'person-1' } as any)
      .mockResolvedValueOnce({ id: 'person-2' } as any)

    vi.mocked(prisma.siblingRelationship.findUnique).mockResolvedValue(null)

    await expect(
      validateSiblingRelationship({
        person1Id: 'person-1',
        person2Id: 'person-2',
      })
    ).resolves.not.toThrow()
  })

  it('should auto-order person IDs (person1Id < person2Id)', async () => {
    vi.mocked(prisma.person.findUnique)
      .mockResolvedValueOnce({ id: 'person-2' } as any)
      .mockResolvedValueOnce({ id: 'person-1' } as any)

    vi.mocked(prisma.siblingRelationship.findUnique).mockResolvedValue(null)

    const data = {
      person1Id: 'person-2',
      person2Id: 'person-1',
    }

    await validateSiblingRelationship(data)

    // Should be swapped
    expect(data.person1Id).toBe('person-1')
    expect(data.person2Id).toBe('person-2')
  })

  it('should reject self-sibling relationship', async () => {
    await expect(
      validateSiblingRelationship({
        person1Id: 'person-1',
        person2Id: 'person-1',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('should reject if person not found', async () => {
    vi.mocked(prisma.person.findUnique)
      .mockResolvedValueOnce({ id: 'person-1' } as any)
      .mockResolvedValueOnce(null)

    await expect(
      validateSiblingRelationship({
        person1Id: 'person-1',
        person2Id: 'person-2',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('should reject duplicate active relationship', async () => {
    vi.mocked(prisma.person.findUnique)
      .mockResolvedValueOnce({ id: 'person-1' } as any)
      .mockResolvedValueOnce({ id: 'person-2' } as any)

    vi.mocked(prisma.siblingRelationship.findUnique).mockResolvedValue({
      id: 'relationship-1',
      isActive: true,
    } as any)

    await expect(
      validateSiblingRelationship({
        person1Id: 'person-1',
        person2Id: 'person-2',
      })
    ).rejects.toThrow(ValidationError)
  })
})

describe('validateBillingAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass validation when total is within subscription amount', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      id: 'sub-1',
      amount: 30000, // $300
      status: 'active',
    } as any)

    vi.mocked(prisma.billingAssignment.findMany).mockResolvedValue([
      { id: 'assign-1', amount: 15000, programProfileId: 'profile-1' },
      { id: 'assign-2', amount: 10000, programProfileId: 'profile-2' },
    ] as any)

    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue({
      id: 'profile-3',
    } as any)

    // Total: $250, new: $50, new total: $300 (within limit)
    await expect(
      validateBillingAssignment({
        subscriptionId: 'sub-1',
        programProfileId: 'profile-3',
        amount: 5000, // $50
      })
    ).resolves.not.toThrow()
  })

  it('should warn but allow over-assignment', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      id: 'sub-1',
      amount: 30000, // $300
      status: 'active',
    } as any)

    vi.mocked(prisma.billingAssignment.findMany).mockResolvedValue([
      { id: 'assign-1', amount: 15000, programProfileId: 'profile-1' },
      { id: 'assign-2', amount: 10000, programProfileId: 'profile-2' },
    ] as any)

    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue({
      id: 'profile-3',
    } as any)

    // Total: $250, new: $100, new total: $350 (exceeds by $50)
    await expect(
      validateBillingAssignment({
        subscriptionId: 'sub-1',
        programProfileId: 'profile-3',
        amount: 10000, // $100
      })
    ).resolves.not.toThrow()

    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should reject if subscription not found', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

    await expect(
      validateBillingAssignment({
        subscriptionId: 'sub-1',
        programProfileId: 'profile-1',
        amount: 10000,
      })
    ).rejects.toThrow(ValidationError)
  })

  it('should reject if program profile not found', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      id: 'sub-1',
      amount: 30000,
      status: 'active',
    } as any)

    vi.mocked(prisma.billingAssignment.findMany).mockResolvedValue([])

    vi.mocked(prisma.programProfile.findUnique).mockResolvedValue(null)

    await expect(
      validateBillingAssignment({
        subscriptionId: 'sub-1',
        programProfileId: 'profile-1',
        amount: 10000,
      })
    ).rejects.toThrow(ValidationError)
  })
})

describe('validateTeacherCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass validation for new teacher', async () => {
    vi.mocked(prisma.person.findUnique).mockResolvedValue({
      id: 'person-1',
      name: 'Ustadh Ali',
    } as any)

    vi.mocked(prisma.teacher.findUnique).mockResolvedValue(null)

    await expect(
      validateTeacherCreation({
        personId: 'person-1',
      })
    ).resolves.not.toThrow()
  })

  it('should reject if person not found', async () => {
    vi.mocked(prisma.person.findUnique).mockResolvedValue(null)

    await expect(
      validateTeacherCreation({
        personId: 'person-1',
      })
    ).rejects.toThrow(ValidationError)
  })

  it('should reject if teacher already exists for person', async () => {
    vi.mocked(prisma.person.findUnique).mockResolvedValue({
      id: 'person-1',
      name: 'Ustadh Ali',
    } as any)

    vi.mocked(prisma.teacher.findUnique).mockResolvedValue({
      id: 'teacher-1',
    } as any)

    await expect(
      validateTeacherCreation({
        personId: 'person-1',
      })
    ).rejects.toThrow(ValidationError)
  })
})

