'use server'

import { revalidatePath } from 'next/cache'

import { Prisma } from '@prisma/client'
import Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { getNewStudentStatus } from '@/lib/queries/subscriptions'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { extractPeriodDates } from '@/lib/utils/type-guards'

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
 * Get all orphaned subscriptions (subscriptions in Stripe not linked to any student)
 */
export async function getOrphanedSubscriptions(): Promise<
  OrphanedSubscription[]
> {
  const orphanedSubs: OrphanedSubscription[] = []
  const stripeClient = getProductionStripeClient()

  // Get all Mahad subscriptions from Stripe
  let mahadSubs: Stripe.Subscription[] = []
  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const response = await stripeClient.subscriptions.list({
      limit: 100,
      starting_after: startingAfter,
      expand: ['data.customer'],
    })

    mahadSubs = mahadSubs.concat(response.data)
    hasMore = response.has_more
    startingAfter = response.data[response.data.length - 1]?.id
  }

  const activeMahadSubs = mahadSubs.filter(
    (sub) =>
      sub.status === 'active' ||
      sub.status === 'trialing' ||
      sub.status === 'past_due'
  )

  // Check which ones are linked in database
  const mahadSubIds = activeMahadSubs.map((sub) => sub.id)
  const linkedMahadSubs = await prisma.student.findMany({
    where: {
      stripeSubscriptionId: { in: mahadSubIds },
      program: 'MAHAD_PROGRAM',
    },
    select: {
      stripeSubscriptionId: true,
    },
  })

  const linkedMahadIds = new Set(
    linkedMahadSubs.map((s) => s.stripeSubscriptionId)
  )

  // Count subscriptions per customer
  const customerSubscriptionCount = new Map<string, number>()
  for (const sub of activeMahadSubs) {
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
    if (customerId) {
      customerSubscriptionCount.set(
        customerId,
        (customerSubscriptionCount.get(customerId) || 0) + 1
      )
    }
  }

  for (const sub of activeMahadSubs) {
    if (!linkedMahadIds.has(sub.id)) {
      const customer = sub.customer as Stripe.Customer
      const customerId =
        typeof sub.customer === 'string' ? sub.customer : customer?.id || ''

      orphanedSubs.push({
        id: sub.id,
        status: sub.status,
        customerEmail: customer?.email || null,
        customerName: customer?.name || null,
        customerId,
        amount: sub.items.data[0]?.price.unit_amount || 0,
        created: new Date(sub.created * 1000),
        currentPeriodStart: (sub as any).current_period_start
          ? new Date((sub as any).current_period_start * 1000)
          : null,
        currentPeriodEnd: (sub as any).current_period_end
          ? new Date((sub as any).current_period_end * 1000)
          : null,
        program: 'MAHAD',
        metadata: sub.metadata || {},
        subscriptionCount: customerSubscriptionCount.get(customerId) || 1,
      })
    }
  }

  // Get all Dugsi subscriptions from Stripe
  const dugsiStripe = getDugsiStripeClient()
  let dugsiSubs: Stripe.Subscription[] = []
  hasMore = true
  startingAfter = undefined

  while (hasMore) {
    const response: Stripe.Response<Stripe.ApiList<Stripe.Subscription>> =
      await dugsiStripe.subscriptions.list({
        limit: 100,
        starting_after: startingAfter,
        expand: ['data.customer'],
      })

    dugsiSubs = dugsiSubs.concat(response.data)
    hasMore = response.has_more
    startingAfter = response.data[response.data.length - 1]?.id
  }

  const activeDugsiSubs = dugsiSubs.filter(
    (sub) =>
      sub.status === 'active' ||
      sub.status === 'trialing' ||
      sub.status === 'past_due'
  )

  const dugsiSubIds = activeDugsiSubs.map((sub) => sub.id)
  const linkedDugsiSubs = await prisma.student.findMany({
    where: {
      stripeSubscriptionIdDugsi: { in: dugsiSubIds },
      program: 'DUGSI_PROGRAM',
    },
    select: {
      stripeSubscriptionIdDugsi: true,
    },
  })

  const linkedDugsiIds = new Set(
    linkedDugsiSubs.map((s) => s.stripeSubscriptionIdDugsi)
  )

  for (const sub of activeDugsiSubs) {
    if (!linkedDugsiIds.has(sub.id)) {
      const customer = sub.customer as Stripe.Customer
      const customerId =
        typeof sub.customer === 'string' ? sub.customer : customer?.id || ''

      orphanedSubs.push({
        id: sub.id,
        status: sub.status,
        customerEmail: customer?.email || null,
        customerName: customer?.name || null,
        customerId,
        amount: sub.items.data[0]?.price.unit_amount || 0,
        created: new Date(sub.created * 1000),
        currentPeriodStart: (sub as any).current_period_start
          ? new Date((sub as any).current_period_start * 1000)
          : null,
        currentPeriodEnd: (sub as any).current_period_end
          ? new Date((sub as any).current_period_end * 1000)
          : null,
        program: 'DUGSI',
        metadata: sub.metadata || {},
        subscriptionCount: 1, // Dugsi typically one per family
      })
    }
  }

  return orphanedSubs
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

      // Find all students in the same family
      const familyStudents = await prisma.student.findMany({
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

          return prisma.student.update({
            where: { id: familyStudent.id },
            data: updateData,
          })
        })
      )

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
