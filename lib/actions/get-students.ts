'use server'

/**
 * Get Students Actions
 *
 * IMPORTANT: These actions need migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

import { createStubbedQuery } from '@/lib/utils/stub-helpers'

// Re-export StudentStatus from canonical source
export { StudentStatus } from '@/lib/types/student'

// Our DTO for the frontend
export interface StudentDTO {
  id: string
  name: string
  monthlyRate: number
  hasCustomRate: boolean
  status: string // Using string to avoid coupling to specific enum
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
export const getStudents = createStubbedQuery<
  [StudentQueryOptions?],
  StudentDTO[]
>({ feature: 'getStudents', reason: 'schema_migration' }, [])

// Helper functions (stubbed)
export const getEligibleStudentsForAutopay = createStubbedQuery<
  [],
  StudentDTO[]
>({ feature: 'getEligibleStudentsForAutopay', reason: 'schema_migration' }, [])

export const getSiblings = createStubbedQuery<[string], StudentDTO[]>(
  { feature: 'getSiblings', reason: 'schema_migration' },
  []
)

export const getAllStudents = createStubbedQuery<[], StudentDTO[]>(
  { feature: 'getAllStudents', reason: 'schema_migration' },
  []
)
