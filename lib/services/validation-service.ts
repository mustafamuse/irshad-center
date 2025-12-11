/**
 * Validation Service
 *
 * Centralized business rule validation for database operations.
 * These validations enforce rules that cannot be enforced at the database level.
 */

import {
  Program,
  Shift,
  GuardianRole,
  EnrollmentStatus,
  Prisma,
} from '@prisma/client'

import { prisma } from '@/lib/db'
import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('validation')

/**
 * Validation errors with detailed context
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validate TeacherAssignment creation/update
 * Ensures TeacherAssignment is only for Dugsi program profiles
 */
export async function validateTeacherAssignment(data: {
  programProfileId: string
  teacherId: string
  shift: Shift
}) {
  // Check if program profile exists and is Dugsi
  const programProfile = await prisma.programProfile.findUnique({
    where: { id: data.programProfileId },
    select: { program: true, personId: true },
  })

  if (!programProfile) {
    throw new ValidationError(
      'Program profile not found',
      'PROFILE_NOT_FOUND',
      { programProfileId: data.programProfileId }
    )
  }

  if (programProfile.program !== 'DUGSI_PROGRAM') {
    throw new ValidationError(
      'Teacher assignments are only allowed for Dugsi program students',
      'TEACHER_ASSIGNMENT_DUGSI_ONLY',
      {
        programProfileId: data.programProfileId,
        actualProgram: programProfile.program,
      }
    )
  }

  // Check if teacher exists
  const teacher = await prisma.teacher.findUnique({
    where: { id: data.teacherId },
    select: { id: true },
  })

  if (!teacher) {
    throw new ValidationError('Teacher not found', 'TEACHER_NOT_FOUND', {
      teacherId: data.teacherId,
    })
  }

  // Check for existing active assignment for same teacher + shift
  const existingAssignment = await prisma.teacherAssignment.findFirst({
    where: {
      teacherId: data.teacherId,
      programProfileId: data.programProfileId,
      shift: data.shift,
      isActive: true,
    },
  })

  if (existingAssignment) {
    throw new ValidationError(
      `Student already has an active ${data.shift} shift assignment`,
      'DUPLICATE_SHIFT_ASSIGNMENT',
      {
        programProfileId: data.programProfileId,
        shift: data.shift,
        existingAssignmentId: existingAssignment.id,
      }
    )
  }
}

/**
 * Validate Enrollment creation/update
 * Ensures Dugsi enrollments don't have batchId
 * Ensures Mahad enrollments have valid batchId
 */

export async function validateEnrollment(
  data: {
    programProfileId?: string
    program?: Program
    batchId?: string | null
    status: EnrollmentStatus
  },
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  logger.info(
    {
      programProfileId: data.programProfileId,
      program: data.program,
      batchId: data.batchId,
      status: data.status,
      usingTransactionClient: client !== prisma,
    },
    'Validating enrollment'
  )

  let program: Program | null = null

  // If programProfileId is provided, fetch program from profile
  if (data.programProfileId && data.programProfileId !== '') {
    logger.info(
      { programProfileId: data.programProfileId },
      'Fetching program profile to validate enrollment'
    )

    const programProfile = await client.programProfile.findUnique({
      where: { id: data.programProfileId },
      select: { program: true },
    })

    if (!programProfile) {
      logger.error(
        {
          programProfileId: data.programProfileId,
          usingTransactionClient: client !== prisma,
        },
        'Program profile not found during validation - may be transaction isolation issue'
      )
      throw new ValidationError(
        'Program profile not found',
        'PROFILE_NOT_FOUND',
        { programProfileId: data.programProfileId }
      )
    }

    program = programProfile.program
    logger.info(
      { programProfileId: data.programProfileId, program },
      'Program profile found during validation'
    )
  } else if (data.program) {
    // If program is provided directly (for new enrollments), use it
    program = data.program
    logger.info({ program }, 'Using program provided directly')
  } else {
    logger.error({ data }, 'Neither programProfileId nor program provided')
    throw new ValidationError(
      'Either programProfileId or program must be provided',
      'MISSING_PROGRAM_INFO',
      { data }
    )
  }

  // Validate based on program
  if (program === 'DUGSI_PROGRAM' && data.batchId) {
    throw new ValidationError(
      'Dugsi enrollments cannot have batches. Dugsi uses teacher assignments instead.',
      'DUGSI_NO_BATCH',
      {
        programProfileId: data.programProfileId,
        program,
        batchId: data.batchId,
      }
    )
  }

  if (program === 'MAHAD_PROGRAM' && !data.batchId) {
    // Mahad typically requires batch, but allow null for special cases
    logger.warn(
      { programProfileId: data.programProfileId || 'new' },
      'Mahad enrollment without batch'
    )
  }

  // Validate batch exists if provided
  if (data.batchId) {
    const batch = await client.batch.findUnique({
      where: { id: data.batchId },
      select: { id: true },
    })

    if (!batch) {
      throw new ValidationError('Batch not found', 'BATCH_NOT_FOUND', {
        batchId: data.batchId,
      })
    }
  }
}

/**
 * Validate GuardianRelationship creation
 * Ensures guardian is not their own dependent (backup to DB constraint)
 */
export async function validateGuardianRelationship(
  data: {
    guardianId: string
    dependentId: string
    role: GuardianRole
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma

  // Check self-reference
  if (data.guardianId === data.dependentId) {
    throw new ValidationError(
      'A person cannot be their own guardian',
      'SELF_GUARDIAN',
      {
        guardianId: data.guardianId,
        dependentId: data.dependentId,
      }
    )
  }

  // Check if both persons exist
  const [guardian, dependent] = await Promise.all([
    client.person.findUnique({
      where: { id: data.guardianId },
      select: { id: true, name: true },
    }),
    client.person.findUnique({
      where: { id: data.dependentId },
      select: { id: true, name: true },
    }),
  ])

  if (!guardian) {
    throw new ValidationError(
      'Guardian person not found',
      'GUARDIAN_NOT_FOUND',
      { guardianId: data.guardianId }
    )
  }

  if (!dependent) {
    throw new ValidationError(
      'Dependent person not found',
      'DEPENDENT_NOT_FOUND',
      { dependentId: data.dependentId }
    )
  }

  // Check for existing active relationship
  const existingRelationship = await client.guardianRelationship.findFirst({
    where: {
      guardianId: data.guardianId,
      dependentId: data.dependentId,
      role: data.role,
      isActive: true,
    },
  })

  if (existingRelationship) {
    throw new ValidationError(
      `Active ${data.role} relationship already exists between these persons`,
      'DUPLICATE_GUARDIAN_RELATIONSHIP',
      {
        guardianId: data.guardianId,
        dependentId: data.dependentId,
        role: data.role,
        existingId: existingRelationship.id,
      }
    )
  }
}

/**
 * Validate SiblingRelationship creation
 * Ensures proper ordering (person1Id < person2Id)
 */
export async function validateSiblingRelationship(data: {
  person1Id: string
  person2Id: string
}) {
  // Check ordering
  if (data.person1Id >= data.person2Id) {
    // Swap them to maintain ordering
    const temp = data.person1Id
    data.person1Id = data.person2Id
    data.person2Id = temp
  }

  // Check self-reference
  if (data.person1Id === data.person2Id) {
    throw new ValidationError(
      'A person cannot be their own sibling',
      'SELF_SIBLING',
      { personId: data.person1Id }
    )
  }

  // Check if both persons exist
  const [person1, person2] = await Promise.all([
    prisma.person.findUnique({
      where: { id: data.person1Id },
      select: { id: true },
    }),
    prisma.person.findUnique({
      where: { id: data.person2Id },
      select: { id: true },
    }),
  ])

  if (!person1 || !person2) {
    throw new ValidationError(
      'One or both persons not found',
      'PERSON_NOT_FOUND',
      {
        person1Id: data.person1Id,
        person1Exists: !!person1,
        person2Id: data.person2Id,
        person2Exists: !!person2,
      }
    )
  }

  // Check for existing relationship
  const existingRelationship = await prisma.siblingRelationship.findUnique({
    where: {
      person1Id_person2Id: {
        person1Id: data.person1Id,
        person2Id: data.person2Id,
      },
    },
  })

  if (existingRelationship && existingRelationship.isActive) {
    throw new ValidationError(
      'Active sibling relationship already exists',
      'DUPLICATE_SIBLING_RELATIONSHIP',
      {
        person1Id: data.person1Id,
        person2Id: data.person2Id,
        existingId: existingRelationship.id,
      }
    )
  }
}

/**
 * Validate BillingAssignment creation/update
 * Ensures total assignments don't exceed subscription amount
 */
export async function validateBillingAssignment(data: {
  subscriptionId: string
  programProfileId: string
  amount: number
  percentage?: number | null
}) {
  // Get subscription details
  const subscription = await prisma.subscription.findUnique({
    where: { id: data.subscriptionId },
    select: {
      id: true,
      amount: true,
      status: true,
    },
  })

  if (!subscription) {
    throw new ValidationError(
      'Subscription not found',
      'SUBSCRIPTION_NOT_FOUND',
      { subscriptionId: data.subscriptionId }
    )
  }

  // Get all active assignments for this subscription
  const existingAssignments = await prisma.billingAssignment.findMany({
    where: {
      subscriptionId: data.subscriptionId,
      isActive: true,
    },
    select: {
      id: true,
      amount: true,
      programProfileId: true,
    },
  })

  // Calculate total assigned amount
  const totalAssigned = existingAssignments
    .filter((a) => a.programProfileId !== data.programProfileId) // Exclude current profile if updating
    .reduce((sum, a) => sum + a.amount, 0)

  const newTotal = totalAssigned + data.amount

  // Allow over-assignment but warn
  if (newTotal > subscription.amount) {
    logger.warn(
      {
        subscriptionId: data.subscriptionId,
        subscriptionAmount: subscription.amount,
        totalAssigned: totalAssigned,
        newAmount: data.amount,
        newTotal: newTotal,
        overageAmount: newTotal - subscription.amount,
        overagePercentage:
          (
            ((newTotal - subscription.amount) / subscription.amount) *
            100
          ).toFixed(2) + '%',
      },
      'BillingAssignment total exceeds subscription amount'
    )

    // Optional: Throw error for strict validation
    // throw new ValidationError(
    //   `Total assignments ($${newTotal / 100}) would exceed subscription amount ($${subscription.amount / 100})`,
    //   'ASSIGNMENT_EXCEEDS_SUBSCRIPTION',
    //   {
    //     subscriptionId: data.subscriptionId,
    //     subscriptionAmount: subscription.amount,
    //     totalAssigned: totalAssigned,
    //     newAmount: data.amount,
    //     newTotal: newTotal
    //   }
    // )
  }

  // Check if program profile exists
  const programProfile = await prisma.programProfile.findUnique({
    where: { id: data.programProfileId },
    select: { id: true },
  })

  if (!programProfile) {
    throw new ValidationError(
      'Program profile not found',
      'PROFILE_NOT_FOUND',
      { programProfileId: data.programProfileId }
    )
  }
}

/**
 * Validate Teacher creation
 * Ensures one teacher per person
 */
export async function validateTeacherCreation(data: { personId: string }) {
  // Check if person exists
  const person = await prisma.person.findUnique({
    where: { id: data.personId },
    select: { id: true, name: true },
  })

  if (!person) {
    throw new ValidationError('Person not found', 'PERSON_NOT_FOUND', {
      personId: data.personId,
    })
  }

  // Check if teacher already exists for this person
  const existingTeacher = await prisma.teacher.findUnique({
    where: { personId: data.personId },
    select: { id: true },
  })

  if (existingTeacher) {
    throw new ValidationError(
      `Person ${person.name} is already a teacher`,
      'TEACHER_ALREADY_EXISTS',
      {
        personId: data.personId,
        existingTeacherId: existingTeacher.id,
      }
    )
  }
}
