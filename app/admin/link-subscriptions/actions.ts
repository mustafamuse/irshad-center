'use server'

import { revalidatePath } from 'next/cache'

import { Prisma } from '@prisma/client'
import Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { getNewStudentStatus } from '@/lib/queries/subscriptions'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { extractCustomerId, extractPeriodDates } from '@/lib/utils/type-guards'

/**
 * Type-safe update data for student subscription linking
 * Extends Prisma's StudentUpdateInput with array push operations
 */
type StudentUpdateData = Prisma.StudentUpdateInput & {
  previousSubscriptionIds?: { push: string }
  previousSubscriptionIdsDugsi?: { push: string }
}

/**
 * Get production Stripe client for admin tools
 * Always uses production keys regardless of NODE_ENV
 */
function getProductionStripeClient(): Stripe {
  const stripeKey = process.env.STRIPE_SECRET_KEY_PROD

  if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY_PROD is not defined')
  }

  return new Stripe(stripeKey, {
    apiVersion: '2025-08-27.basil',
    typescript: true,
  })
}

export interface OrphanedSubscription {
  id: string
  status: string
  customerEmail: string | null
  customerName: string | null
  customerId: string
  amount: number
  created: Date
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  program: 'MAHAD' | 'DUGSI'
  metadata: Record<string, string>
  subscriptionCount: number // How many subscriptions this customer has
}

export interface StudentMatch {
  id: string
  name: string
  email: string
  phone: string | null
  status: string
  hasSubscription: boolean
  program: 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM'
}

/**
 * Filter subscriptions to only active, trialing, or past_due statuses
 */
function filterActiveSubscriptions(
  subscriptions: Stripe.Subscription[]
): Stripe.Subscription[] {
  return subscriptions.filter(
    (sub) =>
      sub.status === 'active' ||
      sub.status === 'trialing' ||
      sub.status === 'past_due'
  )
}

/**
 * Count how many subscriptions each customer has
 * Used for Mahad to track customers with multiple subscriptions
 */
function countSubscriptionsPerCustomer(
  subscriptions: Stripe.Subscription[]
): Map<string, number> {
  const customerSubscriptionCount = new Map<string, number>()
  for (const sub of subscriptions) {
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
    if (customerId) {
      customerSubscriptionCount.set(
        customerId,
        (customerSubscriptionCount.get(customerId) || 0) + 1
      )
    }
  }
  return customerSubscriptionCount
}

/**
 * Fetch all subscriptions from Stripe using pagination
 * Automatically expands customer data for each subscription
 */
async function fetchAllStripeSubscriptions(
  stripeClient: Stripe
): Promise<Stripe.Subscription[]> {
  let subscriptions: Stripe.Subscription[] = []
  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const response = await stripeClient.subscriptions.list({
      limit: 100,
      starting_after: startingAfter,
      expand: ['data.customer'],
    })

    subscriptions = subscriptions.concat(response.data)
    hasMore = response.has_more
    startingAfter = response.data[response.data.length - 1]?.id
  }

  return subscriptions
}

/**
 * Get subscription IDs that are already linked to students in the database
 * Returns a Set for O(1) lookup performance
 */
async function getLinkedSubscriptionIds(
  subscriptionIds: string[],
  program: 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM'
): Promise<Set<string>> {
  if (program === 'MAHAD_PROGRAM') {
    const linkedStudents = await prisma.student.findMany({
      where: {
        stripeSubscriptionId: { in: subscriptionIds },
        program: 'MAHAD_PROGRAM',
      },
      select: {
        stripeSubscriptionId: true,
      },
    })

    return new Set(
      linkedStudents
        .map((s) => s.stripeSubscriptionId)
        .filter((id): id is string => id !== null)
    )
  } else {
    const linkedStudents = await prisma.student.findMany({
      where: {
        stripeSubscriptionIdDugsi: { in: subscriptionIds },
        program: 'DUGSI_PROGRAM',
      },
      select: {
        stripeSubscriptionIdDugsi: true,
      },
    })

    return new Set(
      linkedStudents
        .map((s) => s.stripeSubscriptionIdDugsi)
        .filter((id): id is string => id !== null)
    )
  }
}

/**
 * Build an OrphanedSubscription object from a Stripe subscription
 * Uses type-safe helpers for customer ID and period date extraction
 */
function buildOrphanedSubscriptionObject(
  sub: Stripe.Subscription,
  program: 'MAHAD' | 'DUGSI',
  customerSubscriptionCount?: Map<string, number>
): OrphanedSubscription {
  const customer = sub.customer as Stripe.Customer
  // extractCustomerId returns string | null, default to empty string for compatibility
  const customerId = extractCustomerId(sub.customer) || ''

  // Use type-safe period date extraction
  const periodDates = extractPeriodDates(sub)

  return {
    id: sub.id,
    status: sub.status,
    customerEmail: customer?.email ?? null,
    customerName: customer?.name ?? null,
    customerId,
    amount: sub.items.data[0]?.price.unit_amount || 0,
    created: new Date(sub.created * 1000),
    currentPeriodStart: periodDates.periodStart ?? null,
    currentPeriodEnd: periodDates.periodEnd ?? null,
    program,
    metadata: sub.metadata || {},
    subscriptionCount: customerSubscriptionCount
      ? (customerSubscriptionCount.get(customerId) ?? 1)
      : 1,
  }
}

/**
 * Get orphaned subscriptions for a specific program (Mahad or Dugsi)
 * Composable function that handles all the logic for one program at a time
 */
async function getOrphanedSubscriptionsForProgram(
  stripeClient: Stripe,
  program: 'MAHAD' | 'DUGSI',
  prismaProgram: 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM',
  countCustomerSubscriptions: boolean
): Promise<OrphanedSubscription[]> {
  // Fetch all subscriptions from Stripe
  const allSubscriptions = await fetchAllStripeSubscriptions(stripeClient)

  // Filter to only active/trialing/past_due subscriptions
  const activeSubscriptions = filterActiveSubscriptions(allSubscriptions)

  // Get IDs of subscriptions already linked in database
  const subscriptionIds = activeSubscriptions.map((sub) => sub.id)
  const linkedIds = await getLinkedSubscriptionIds(
    subscriptionIds,
    prismaProgram
  )

  // Count subscriptions per customer (Mahad only)
  const customerSubCount = countCustomerSubscriptions
    ? countSubscriptionsPerCustomer(activeSubscriptions)
    : undefined

  // Build orphaned subscription objects for unlinked subscriptions
  const orphanedSubs: OrphanedSubscription[] = []
  for (const sub of activeSubscriptions) {
    if (!linkedIds.has(sub.id)) {
      orphanedSubs.push(
        buildOrphanedSubscriptionObject(sub, program, customerSubCount)
      )
    }
  }

  return orphanedSubs
}

/**
 * Get all orphaned subscriptions (subscriptions in Stripe not linked to any student)
 * Combines results from both Mahad and Dugsi programs
 */
export async function getOrphanedSubscriptions(): Promise<
  OrphanedSubscription[]
> {
  // Process Mahad subscriptions (with customer subscription counting)
  const mahadOrphaned = await getOrphanedSubscriptionsForProgram(
    getProductionStripeClient(),
    'MAHAD',
    'MAHAD_PROGRAM',
    true // Count subscriptions per customer
  )

  // Process Dugsi subscriptions (without customer counting - typically one per family)
  const dugsiOrphaned = await getOrphanedSubscriptionsForProgram(
    getDugsiStripeClient(),
    'DUGSI',
    'DUGSI_PROGRAM',
    false // Don't count - Dugsi typically one per family
  )

  return [...mahadOrphaned, ...dugsiOrphaned]
}

/**
 * Search for students by name, email, or ID
 */
export async function searchStudents(
  query: string,
  program?: 'MAHAD' | 'DUGSI'
): Promise<StudentMatch[]> {
  const programFilter =
    program === 'MAHAD'
      ? 'MAHAD_PROGRAM'
      : program === 'DUGSI'
        ? 'DUGSI_PROGRAM'
        : undefined

  const where: Prisma.StudentWhereInput = programFilter
    ? {
        program: programFilter,
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
          { phone: { contains: query, mode: 'insensitive' as const } },
          { id: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
          { phone: { contains: query, mode: 'insensitive' as const } },
          { id: { contains: query, mode: 'insensitive' as const } },
        ],
      }

  const students = await prisma.student.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      program: true,
      stripeSubscriptionId: true,
      stripeSubscriptionIdDugsi: true,
    },
    take: 20,
    orderBy: {
      name: 'asc',
    },
  })

  return students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email || '',
    phone: s.phone,
    status: s.status,
    hasSubscription: !!(s.stripeSubscriptionId || s.stripeSubscriptionIdDugsi),
    program: s.program as 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM',
  }))
}

/**
 * Get potential student matches for a subscription based on email
 */
export async function getPotentialMatches(
  email: string | null,
  program: 'MAHAD' | 'DUGSI'
): Promise<StudentMatch[]> {
  if (!email) return []

  const programFilter = program === 'MAHAD' ? 'MAHAD_PROGRAM' : 'DUGSI_PROGRAM'

  const students = await prisma.student.findMany({
    where: {
      program: programFilter,
      email: email,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      program: true,
      stripeSubscriptionId: true,
      stripeSubscriptionIdDugsi: true,
    },
  })

  return students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email || '',
    phone: s.phone,
    status: s.status,
    hasSubscription: !!(s.stripeSubscriptionId || s.stripeSubscriptionIdDugsi),
    program: s.program as 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM',
  }))
}

/**
 * Link a subscription to a student
 */
export async function linkSubscriptionToStudent(
  subscriptionId: string,
  studentId: string,
  program: 'MAHAD' | 'DUGSI'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (program === 'MAHAD') {
      // Get student
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          program: 'MAHAD_PROGRAM',
        },
        select: {
          id: true,
          name: true,
          email: true,
          stripeSubscriptionId: true,
          subscriptionStatus: true,
        },
      })

      if (!student) {
        return {
          success: false,
          error: 'Student not found or not in Mahad program',
        }
      }

      // Get subscription from Stripe
      const stripeClient = getProductionStripeClient()
      const subscription =
        await stripeClient.subscriptions.retrieve(subscriptionId)

      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id

      if (!customerId) {
        return { success: false, error: 'Invalid customer ID in subscription' }
      }

      const newStudentStatus = getNewStudentStatus(subscription.status)

      // Extract period dates
      const periodDates = extractPeriodDates(subscription)
      const statusChanged = student.subscriptionStatus !== subscription.status

      // Track subscription history: check if student already has a subscription
      const oldSubscriptionId = student.stripeSubscriptionId
      const updateData: StudentUpdateData = {
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        subscriptionStatus: subscription.status,
        status: newStudentStatus,
        paidUntil: periodDates.periodEnd,
        currentPeriodStart: periodDates.periodStart,
        currentPeriodEnd: periodDates.periodEnd,
        monthlyRate: subscription.items.data[0]?.price.unit_amount || 0,
        // Only update timestamp if status actually changed
        ...(statusChanged && {
          subscriptionStatusUpdatedAt: new Date(),
        }),
      }

      /**
       * Track subscription history
       *
       * Note: Potential race condition if multiple admins link subscriptions simultaneously.
       * The subscription history could be missed since the read-then-write is not atomic.
       * This is acceptable for admin tool context with low concurrency.
       * For high-concurrency scenarios (like webhook handlers), consider using transactions.
       */
      if (oldSubscriptionId && oldSubscriptionId !== subscriptionId) {
        updateData.previousSubscriptionIds = {
          push: oldSubscriptionId,
        }
      }

      // Link subscription to student
      await prisma.student.update({
        where: { id: studentId },
        data: updateData,
      })

      revalidatePath('/admin/link-subscriptions')
      return { success: true }
    } else if (program === 'DUGSI') {
      // Get student
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          program: 'DUGSI_PROGRAM',
        },
        select: {
          id: true,
          name: true,
          parentEmail: true,
          stripeSubscriptionIdDugsi: true,
        },
      })

      if (!student) {
        return {
          success: false,
          error: 'Student not found or not in Dugsi program',
        }
      }

      // Validate parentEmail is not null/empty to prevent matching all null emails
      if (!student.parentEmail || student.parentEmail.trim() === '') {
        return {
          success: false,
          error:
            'Parent email is required to link subscription. Please update the student record with a parent email first.',
        }
      }

      // Get subscription from Stripe
      const dugsiStripe = getDugsiStripeClient()
      const subscription =
        await dugsiStripe.subscriptions.retrieve(subscriptionId)

      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id

      if (!customerId) {
        return { success: false, error: 'Invalid customer ID in subscription' }
      }

      const newStudentStatus = getNewStudentStatus(subscription.status)

      // Extract period dates
      const periodDates = extractPeriodDates(subscription)

      // Use transaction to atomically update all family members
      await prisma.$transaction(async (tx) => {
        // Find all students in the same family
        const familyStudents = await tx.student.findMany({
          where: {
            parentEmail: student.parentEmail,
            program: 'DUGSI_PROGRAM',
          },
          select: {
            id: true,
            stripeSubscriptionIdDugsi: true,
            subscriptionStatus: true,
          },
        })

        // Update each student individually to track subscription history
        await Promise.all(
          familyStudents.map((familyStudent) => {
            const oldSubscriptionId = familyStudent.stripeSubscriptionIdDugsi
            const statusChanged =
              familyStudent.subscriptionStatus !== subscription.status

            const updateData: StudentUpdateData = {
              stripeSubscriptionIdDugsi: subscriptionId,
              stripeCustomerIdDugsi: customerId,
              subscriptionStatus: subscription.status,
              status: newStudentStatus,
              paidUntil: periodDates.periodEnd,
              currentPeriodStart: periodDates.periodStart,
              currentPeriodEnd: periodDates.periodEnd,
              monthlyRate: subscription.items.data[0]?.price.unit_amount || 0,
              // Only update timestamp if status actually changed
              ...(statusChanged && {
                subscriptionStatusUpdatedAt: new Date(),
              }),
            }

            // Add old subscription ID to history if it exists and is different
            if (oldSubscriptionId && oldSubscriptionId !== subscriptionId) {
              updateData.previousSubscriptionIdsDugsi = {
                push: oldSubscriptionId,
              }
            }

            return tx.student.update({
              where: { id: familyStudent.id },
              data: updateData,
            })
          })
        )
      })

      revalidatePath('/admin/link-subscriptions')
      return { success: true }
    }

    return { success: false, error: 'Invalid program specified' }
  } catch (error: any) {
    console.error('Error linking subscription:', error)
    return {
      success: false,
      error: error.message || 'Failed to link subscription',
    }
  }
}
