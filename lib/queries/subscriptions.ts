import { SubscriptionStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
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
  studentId: string
): Promise<StudentSubscriptionInfo> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      stripeSubscriptionId: true,
      stripeCustomerId: true,
      subscriptionStatus: true,
    },
  })

  if (!student) {
    return {
      isSubscribed: false,
      status: null,
      stripeSubscriptionId: null,
      stripeCustomerId: null,
    }
  }

  return {
    isSubscribed: student.subscriptionStatus === 'active',
    status: (student.subscriptionStatus as SubscriptionStatus) || null,
    stripeSubscriptionId: student.stripeSubscriptionId,
    stripeCustomerId: student.stripeCustomerId,
  }
}

/**
 * Get all students with active subscriptions
 */
export async function getActiveSubscriptions() {
  return prisma.student.findMany({
    where: {
      subscriptionStatus: 'active',
      stripeSubscriptionId: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
      subscriptionStatus: true,
      monthlyRate: true,
      Batch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })
}

/**
 * Update student subscription status
 */
export async function updateStudentSubscriptionStatus(
  studentId: string,
  newStatus: SubscriptionStatus,
  options?: {
    stripeSubscriptionId?: string
    lastPaymentDate?: Date
    nextPaymentDate?: Date
  }
) {
  return prisma.student.update({
    where: { id: studentId },
    data: {
      subscriptionStatus: newStatus,
      stripeSubscriptionId: options?.stripeSubscriptionId,
      lastPaymentDate: options?.lastPaymentDate,
      nextPaymentDue: options?.nextPaymentDate,
      status: getNewStudentStatus(newStatus),
    },
  })
}

// Helper function to map subscription status to student status
function getNewStudentStatus(
  subscriptionStatus: SubscriptionStatus
): StudentStatus {
  switch (subscriptionStatus) {
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
export async function validateStudentForEnrollment(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      Sibling: {
        include: {
          Student: {
            select: {
              id: true,
              name: true,
              monthlyRate: true,
              customRate: true,
            },
          },
        },
      },
      Batch: true,
    },
  })

  if (!student) {
    throw new Error('Student not found')
  }

  // Check if student already has an active subscription
  if (student.subscriptionStatus === 'active') {
    throw new Error('Student already has an active subscription')
  }

  // Check if student is in valid status for enrollment
  if (student.status !== 'registered') {
    throw new Error(
      `Student status ${student.status} is not eligible for enrollment`
    )
  }

  return {
    student: {
      id: student.id,
      name: student.name,
      monthlyRate: student.monthlyRate,
      customRate: student.customRate,
      batch: student.Batch,
      siblingGroup: student.Sibling,
    },
    isEligible: true,
  }
}

/**
 * Get students eligible for enrollment (no active subscription)
 */
export async function getEligibleStudents() {
  return prisma.student.findMany({
    where: {
      OR: [
        { subscriptionStatus: null },
        { subscriptionStatus: { not: 'active' } },
      ],
      status: 'registered',
    },
    include: {
      Batch: true,
      Sibling: {
        include: {
          Student: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  })
}
