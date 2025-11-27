'use server'

/**
 * Get Students Actions
 *
 * Query functions for Mahad students. Uses existing services and mappers.
 */

import type {
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { getProgramProfileById } from '@/lib/db/queries/program-profile'
import { getPersonSiblings } from '@/lib/db/queries/siblings'
import { mahadEnrollmentInclude } from '@/lib/mappers/mahad-mapper'
import { calculateMahadRate } from '@/lib/utils/mahad-tuition'

// Re-export StudentStatus from canonical source
export { StudentStatus } from '@/lib/types/student'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface StudentDTO {
  id: string
  name: string
  // Calculated rate based on billing configuration (in cents)
  calculatedRate: number
  // Mahad billing configuration
  graduationStatus: GraduationStatus | null
  paymentFrequency: PaymentFrequency | null
  billingType: StudentBillingType | null
  status: string
  siblingGroupId: string | null
  batchId: string | null
  batchName: string | null
  email: string | null
  phone: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null
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

// ============================================================================
// MAIN QUERY FUNCTIONS
// ============================================================================

/**
 * Get Mahad students with optional filtering
 *
 * Queries enrollments and maps to StudentDTO format.
 */
export async function getStudents(
  options?: StudentQueryOptions
): Promise<StudentDTO[]> {
  const { includeInactive = false, siblingGroupId } = options || {}

  const enrollments = await prisma.enrollment.findMany({
    where: {
      programProfile: {
        program: MAHAD_PROGRAM,
      },
      status: includeInactive ? undefined : { not: 'WITHDRAWN' },
      endDate: includeInactive ? undefined : null,
    },
    include: mahadEnrollmentInclude,
    orderBy: {
      programProfile: {
        person: {
          name: 'asc',
        },
      },
    },
  })

  // Map to DTOs
  const students = enrollments.map(mapEnrollmentToStudentDTO)

  // Filter by sibling group if specified
  if (siblingGroupId) {
    return students.filter((s) => s.siblingGroupId === siblingGroupId)
  }

  return students
}

/**
 * Get students eligible for autopay enrollment
 *
 * Returns students without active subscriptions who are enrolled.
 */
export async function getEligibleStudentsForAutopay(): Promise<StudentDTO[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      programProfile: {
        program: MAHAD_PROGRAM,
        // No active subscription
        assignments: {
          none: {
            isActive: true,
            subscription: {
              status: 'active',
            },
          },
        },
      },
      status: { in: ['REGISTERED', 'ENROLLED'] },
      endDate: null,
    },
    include: mahadEnrollmentInclude,
    orderBy: {
      programProfile: {
        person: {
          name: 'asc',
        },
      },
    },
  })

  return enrollments.map(mapEnrollmentToStudentDTO)
}

/**
 * Get siblings for a student
 *
 * Uses getPersonSiblings to find sibling relationships.
 * Batch fetches enrollments to avoid N+1 queries.
 */
export async function getSiblings(studentId: string): Promise<StudentDTO[]> {
  const profile = await getProgramProfileById(studentId)
  if (!profile) {
    return []
  }

  const siblings = await getPersonSiblings(profile.personId)
  if (siblings.length === 0) {
    return []
  }

  // Collect all Mahad profile IDs for batch query
  const mahadProfileIds = siblings.flatMap((sibling) =>
    sibling.profiles.filter((p) => p.program === MAHAD_PROGRAM).map((p) => p.id)
  )

  if (mahadProfileIds.length === 0) {
    return []
  }

  // Batch fetch all enrollments in single query (fixes N+1)
  const enrollments = await prisma.enrollment.findMany({
    where: {
      programProfileId: { in: mahadProfileIds },
      status: { not: 'WITHDRAWN' },
      endDate: null,
    },
    include: mahadEnrollmentInclude,
  })

  return enrollments.map(mapEnrollmentToStudentDTO)
}

/**
 * Get all Mahad students (non-withdrawn)
 *
 * Simple query for all active students.
 */
export async function getAllStudents(): Promise<StudentDTO[]> {
  return getStudents({ includeInactive: false })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Maps enrollment data to StudentDTO format
 */
function mapEnrollmentToStudentDTO(enrollment: {
  id: string
  status: string
  programProfile: {
    id: string
    graduationStatus: GraduationStatus | null
    paymentFrequency: PaymentFrequency | null
    billingType: StudentBillingType | null
    person: {
      name: string
      contactPoints?: Array<{ type: string; value: string }>
    }
    assignments: Array<{
      subscription: {
        id: string
        stripeSubscriptionId: string | null
        stripeCustomerId: string | null
        status: string
      } | null
    }>
  }
  batch: { id: string; name: string } | null
}): StudentDTO {
  const profile = enrollment.programProfile
  const person = profile.person
  const assignment = profile.assignments[0]
  const subscription = assignment?.subscription

  // Extract contact points (inline to match local narrow type)
  const emailContact = person.contactPoints?.find((cp) => cp.type === 'EMAIL')
  const phoneContact = person.contactPoints?.find(
    (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
  )

  // Determine subscription status
  const hasActiveSubscription = subscription?.status === 'active'
  const isEligibleForAutopay = !hasActiveSubscription

  // Calculate rate using the formula-based rate system
  const calculatedRate = calculateMahadRate(
    profile.graduationStatus,
    profile.paymentFrequency,
    profile.billingType
  )

  return {
    id: profile.id,
    name: person.name,
    calculatedRate,
    graduationStatus: profile.graduationStatus,
    paymentFrequency: profile.paymentFrequency,
    billingType: profile.billingType,
    status: enrollment.status.toLowerCase(),
    siblingGroupId: null, // Intentionally null - use getSiblings() for sibling data
    batchId: enrollment.batch?.id ?? null,
    batchName: enrollment.batch?.name ?? null,
    email: emailContact?.value ?? null,
    phone: phoneContact?.value ?? null,
    stripeCustomerId: subscription?.stripeCustomerId ?? null,
    stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
    subscriptionStatus: subscription?.status ?? null,
    isEligibleForAutopay,
    hasActiveSubscription,
    familyDiscount: {
      applied: false, // Would need sibling count to calculate
      amount: 0,
      siblingCount: 0,
    },
  }
}
