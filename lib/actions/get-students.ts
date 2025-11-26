'use server'

/**
 * Get Students Actions
 *
 * IMPORTANT: These actions need migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

// Enums and constants
export enum StudentStatus {
  REGISTERED = 'registered',
  ENROLLED = 'enrolled',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

// Our DTO for the frontend
export interface StudentDTO {
  id: string
  name: string
  monthlyRate: number
  hasCustomRate: boolean
  status: StudentStatus
  siblingGroupId: string | null
  batchId: string | null
  batchName: string | null
  email: string | null
  phone: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null
  // Computed fields
  isEligibleForAutopay: boolean
  hasActiveSubscription: boolean
  familyDiscount: {
    applied: boolean
    amount: number
    siblingCount: number
  }
}

interface StudentQueryOptions {
  includeInactive?: boolean
  includeBatchInfo?: boolean
  siblingGroupId?: string
}

// Main query function (stubbed)
export async function getStudents(
  _options: StudentQueryOptions = {}
): Promise<StudentDTO[]> {
  console.error('[GET_STUDENTS] getStudents disabled during schema migration')
  return []
}

// Helper functions (stubbed)
export async function getEligibleStudentsForAutopay(): Promise<StudentDTO[]> {
  console.error(
    '[GET_STUDENTS] getEligibleStudentsForAutopay disabled during schema migration'
  )
  return []
}

export async function getSiblings(
  _siblingGroupId: string
): Promise<StudentDTO[]> {
  console.error('[GET_STUDENTS] getSiblings disabled during schema migration')
  return []
}

export async function getAllStudents(): Promise<StudentDTO[]> {
  console.error(
    '[GET_STUDENTS] getAllStudents disabled during schema migration'
  )
  return []
}
