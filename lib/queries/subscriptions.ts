// ⚠️ CRITICAL MIGRATION NEEDED: This file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model

import { SubscriptionStatus } from '@prisma/client'

import { StudentStatus } from '@/lib/types/student'

// Constants for payment processing
export const PAYMENT_RULES = {
  GRACE_PERIOD_DAYS: 7,
  RETRY: {
    MAX_ATTEMPTS: 3,
    INTERVALS: [3, 7, 14] as const, // Days between retries
  },
}

// Helper to calculate grace period end date
export function getGracePeriodEnd(startDate: Date): Date {
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + PAYMENT_RULES.GRACE_PERIOD_DAYS)
  return endDate
}

export interface StudentSubscriptionInfo {
  isSubscribed: boolean
  status: SubscriptionStatus | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
}

/**
 * Get student subscription status from the simplified schema
 */
export async function getStudentSubscriptionStatus(
  _studentId: string
): Promise<StudentSubscriptionInfo> {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return {
    isSubscribed: false,
    status: null,
    stripeSubscriptionId: null,
    stripeCustomerId: null,
  } // Temporary: return empty subscription info until migration complete
}

/**
 * Get all students with active subscriptions
 */
export async function getActiveSubscriptions() {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}

/**
 * Update student subscription status
 */
export async function updateStudentSubscriptionStatus(
  _studentId: string,
  _newStatus: SubscriptionStatus,
  _options?: {
    stripeSubscriptionId?: string
    lastPaymentDate?: Date
    nextPaymentDate?: Date
  }
) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}

// Helper function to map subscription status to student status
export function getNewStudentStatus(
  subscriptionStatus: SubscriptionStatus | string
): StudentStatus {
  // Handle string status from Stripe
  const status =
    typeof subscriptionStatus === 'string'
      ? (subscriptionStatus as SubscriptionStatus)
      : subscriptionStatus

  switch (status) {
    case SubscriptionStatus.active:
      return StudentStatus.ENROLLED
    case SubscriptionStatus.canceled:
    case SubscriptionStatus.unpaid:
      return StudentStatus.WITHDRAWN
    case SubscriptionStatus.past_due:
      return StudentStatus.ENROLLED // Keep as enrolled during grace period
    default:
      return StudentStatus.REGISTERED
  }
}

/**
 * Validate if a student can be enrolled
 */
export async function validateStudentForEnrollment(_studentId: string) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}

/**
 * Get students eligible for enrollment (no active subscription)
 */
export async function getEligibleStudents() {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}
