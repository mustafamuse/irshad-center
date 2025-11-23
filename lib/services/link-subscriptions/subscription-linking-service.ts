/**
 * Subscription Linking Service
 *
 * Cross-program service for finding and linking orphaned subscriptions.
 * Handles subscriptions in Stripe that aren't yet linked to program profiles.
 *
 * Responsibilities:
 * - Find orphaned subscriptions (in Stripe but not linked)
 * - Search for students to link
 * - Match subscriptions to students by email
 * - Link subscriptions to program profiles
 *
 * Uses shared services for DRY implementation.
 */

import { StripeAccountType } from '@prisma/client'
import Stripe from 'stripe'

import { prisma } from '@/lib/db'
import {
  getBillingAssignmentsByProfile,
  getSubscriptionByStripeId,
} from '@/lib/db/queries/billing'
import {
  getProgramProfileById,
  getProgramProfiles,
  searchProgramProfilesByNameOrContact,
} from '@/lib/db/queries/program-profile'
import { createServiceLogger } from '@/lib/logger'
import {
  createOrUpdateBillingAccount,
  linkSubscriptionToProfiles,
} from '@/lib/services/shared/billing-service'
import {
  validateStripeSubscription,
  createSubscriptionFromStripe,
  updateSubscriptionStatus,
} from '@/lib/services/shared/subscription-service'
import { getStripeClient } from '@/lib/utils/stripe-client'
import { extractCustomerId, extractPeriodDates } from '@/lib/utils/type-guards'

const logger = createServiceLogger('subscription-linking')

/**
 * Orphaned subscription DTO
 */
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
  subscriptionCount: number
}

/**
 * Student match DTO
 */
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
 * Subscription link result
 */
export interface SubscriptionLinkResult {
  success: boolean
  error?: string
}

/**
 * Filter subscriptions to only active, trialing, or past_due statuses.
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
 * Count how many subscriptions each customer has.
 * Used for Mahad to track customers with multiple subscriptions.
 */
function countSubscriptionsPerCustomer(
  subscriptions: Stripe.Subscription[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const sub of subscriptions) {
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
    if (customerId) {
      counts.set(customerId, (counts.get(customerId) || 0) + 1)
    }
  }
  return counts
}

/**
 * Fetch all subscriptions from Stripe using pagination.
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
 * Get subscription IDs that are already linked to students.
 */
async function getLinkedSubscriptionIds(
  subscriptionIds: string[],
  accountType: StripeAccountType
): Promise<Set<string>> {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      stripeSubscriptionId: { in: subscriptionIds },
      stripeAccountType: accountType,
      assignments: {
        some: {
          isActive: true,
        },
      },
    },
    select: {
      stripeSubscriptionId: true,
    },
  })

  return new Set(subscriptions.map((s) => s.stripeSubscriptionId))
}

/**
 * Build an OrphanedSubscription object from a Stripe subscription.
 */
function buildOrphanedSubscriptionObject(
  sub: Stripe.Subscription,
  program: 'MAHAD' | 'DUGSI',
  customerSubscriptionCount?: Map<string, number>
): OrphanedSubscription | null {
  const customer = sub.customer as Stripe.Customer
  const customerId = extractCustomerId(sub.customer)

  if (!customerId) {
    logger.warn(
      { subscriptionId: sub.id },
      'Skipping subscription - invalid customer ID'
    )
    return null
  }

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
 * Get orphaned subscriptions for a specific program.
 *
 * Orphaned = subscriptions in Stripe that aren't linked to any program profile.
 *
 * @param accountType - Stripe account type
 * @param program - Program identifier
 * @param countCustomerSubscriptions - Whether to count subscriptions per customer
 * @returns Array of orphaned subscriptions
 */
async function getOrphanedSubscriptionsForProgram(
  accountType: StripeAccountType,
  program: 'MAHAD' | 'DUGSI',
  countCustomerSubscriptions: boolean
): Promise<OrphanedSubscription[]> {
  // Fetch all subscriptions from Stripe
  const stripeClient = getStripeClient(accountType)
  const allSubscriptions = await fetchAllStripeSubscriptions(stripeClient)

  // Filter to only active/trialing/past_due subscriptions
  const activeSubscriptions = filterActiveSubscriptions(allSubscriptions)

  // Get IDs of subscriptions already linked in database
  const subscriptionIds = activeSubscriptions.map((sub) => sub.id)
  const linkedIds = await getLinkedSubscriptionIds(subscriptionIds, accountType)

  // Count subscriptions per customer (Mahad only)
  const customerSubCount = countCustomerSubscriptions
    ? countSubscriptionsPerCustomer(activeSubscriptions)
    : undefined

  // Build orphaned subscription objects for unlinked subscriptions
  const orphanedSubs: OrphanedSubscription[] = []
  for (const sub of activeSubscriptions) {
    if (!linkedIds.has(sub.id)) {
      const orphanedSub = buildOrphanedSubscriptionObject(
        sub,
        program,
        customerSubCount
      )
      if (orphanedSub) {
        orphanedSubs.push(orphanedSub)
      }
    }
  }

  return orphanedSubs
}

/**
 * Get all orphaned subscriptions across all programs.
 *
 * @returns Array of orphaned subscriptions from Mahad and Dugsi
 */
export async function getAllOrphanedSubscriptions(): Promise<
  OrphanedSubscription[]
> {
  const [mahadOrphaned, dugsiOrphaned] = await Promise.all([
    getOrphanedSubscriptionsForProgram('MAHAD', 'MAHAD', true),
    getOrphanedSubscriptionsForProgram('DUGSI', 'DUGSI', false),
  ])

  return [...mahadOrphaned, ...dugsiOrphaned]
}

/**
 * Search for students by name, email, or ID.
 *
 * @param query - Search query
 * @param program - Program to search (optional)
 * @returns Array of student matches
 */
export async function searchStudentsForLinking(
  query: string,
  program?: 'MAHAD' | 'DUGSI'
): Promise<StudentMatch[]> {
  const prismaProgram =
    program === 'MAHAD'
      ? ('MAHAD_PROGRAM' as const)
      : ('DUGSI_PROGRAM' as const)

  const { profiles } = await getProgramProfiles({
    program: program ? prismaProgram : undefined,
    search: query,
    limit: 50,
  })

  const matches: StudentMatch[] = []
  for (const profile of profiles) {
    const assignments = await getBillingAssignmentsByProfile(profile.id)
    const hasSubscription = assignments.some(
      (a) =>
        a.subscription.status === 'active' ||
        a.subscription.status === 'trialing' ||
        a.subscription.status === 'past_due'
    )

    const email =
      profile.person.contactPoints.find((cp) => cp.type === 'EMAIL')?.value ||
      ''
    const phone =
      profile.person.contactPoints.find(
        (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
      )?.value || null

    matches.push({
      id: profile.id,
      name: profile.person.name,
      email,
      phone,
      status: profile.status,
      hasSubscription,
      program: profile.program as 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM',
    })
  }

  return matches
}

/**
 * Get potential student matches for a subscription based on email.
 *
 * @param email - Customer email from subscription
 * @param program - Program to search
 * @returns Array of potential student matches
 */
export async function getPotentialStudentMatches(
  email: string | null,
  program: 'MAHAD' | 'DUGSI'
): Promise<StudentMatch[]> {
  if (!email) {
    return []
  }

  const prismaProgram =
    program === 'MAHAD'
      ? ('MAHAD_PROGRAM' as const)
      : ('DUGSI_PROGRAM' as const)

  const profiles = await searchProgramProfilesByNameOrContact(
    email,
    prismaProgram
  )

  const matches: StudentMatch[] = []
  for (const profile of profiles) {
    const assignments = await getBillingAssignmentsByProfile(profile.id)
    const hasSubscription = assignments.some(
      (a) =>
        a.subscription.status === 'active' ||
        a.subscription.status === 'trialing' ||
        a.subscription.status === 'past_due'
    )

    const profileEmail =
      profile.person.contactPoints.find((cp) => cp.type === 'EMAIL')?.value ||
      ''
    const phone =
      profile.person.contactPoints.find(
        (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
      )?.value || null

    matches.push({
      id: profile.id,
      name: profile.person.name,
      email: profileEmail,
      phone,
      status: profile.status,
      hasSubscription,
      program: prismaProgram,
    })
  }

  return matches
}

/**
 * Link a subscription to a program profile.
 *
 * Uses shared services for DRY implementation.
 *
 * @param subscriptionId - Stripe subscription ID
 * @param profileId - Program profile ID
 * @param program - Program type
 * @returns Link result
 */
export async function linkSubscriptionToProfile(
  subscriptionId: string,
  profileId: string,
  program: 'MAHAD' | 'DUGSI'
): Promise<SubscriptionLinkResult> {
  try {
    // Get the program profile
    const profile = await getProgramProfileById(profileId)
    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    const prismaProgram =
      program === 'MAHAD' ? 'MAHAD_PROGRAM' : 'DUGSI_PROGRAM'
    if (profile.program !== prismaProgram) {
      return {
        success: false,
        error: `Profile is not in ${program} program`,
      }
    }

    const accountType: StripeAccountType =
      program === 'MAHAD' ? 'MAHAD' : 'DUGSI'

    // Validate subscription exists in Stripe
    const validationResult = await validateStripeSubscription(
      subscriptionId,
      accountType
    )

    // Get or create billing account
    const billingAccount = await createOrUpdateBillingAccount({
      personId: profile.personId,
      accountType,
      stripeCustomerId: validationResult.customerId,
    })

    // Check if subscription exists in database
    let subscription = await getSubscriptionByStripeId(subscriptionId)

    if (!subscription) {
      // Get full Stripe subscription object
      const stripeClient = getStripeClient(accountType)
      const stripeSubscription =
        await stripeClient.subscriptions.retrieve(subscriptionId)

      // Create subscription in database
      subscription = await createSubscriptionFromStripe(
        stripeSubscription,
        billingAccount.id,
        accountType
      )
    } else {
      // Update existing subscription status
      await updateSubscriptionStatus(subscriptionId, subscription.status, {
        currentPeriodStart: validationResult.currentPeriodStart,
        currentPeriodEnd: validationResult.currentPeriodEnd,
        paidUntil: validationResult.currentPeriodEnd,
      })
    }

    // Link subscription to profile using shared service
    await linkSubscriptionToProfiles(
      subscription.id,
      [profileId],
      validationResult.amount,
      'Linked via admin interface'
    )

    return { success: true }
  } catch (error) {
    logger.error({ err: error }, 'Error linking subscription')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
