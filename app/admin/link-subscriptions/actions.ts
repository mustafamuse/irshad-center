'use server'

import { revalidatePath } from 'next/cache'

import { SubscriptionStatus } from '@prisma/client'
import Stripe from 'stripe'

import { prisma } from '@/lib/db'
import {
  getBillingAssignmentsByProfile,
  upsertBillingAccount,
  createSubscription,
  updateSubscriptionStatus,
  createBillingAssignment,
} from '@/lib/db/queries/billing'
import {
  getProgramProfileById,
  getProgramProfiles,
  searchProgramProfilesByNameOrContact,
} from '@/lib/db/queries/program-profile'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { extractCustomerId, extractPeriodDates } from '@/lib/utils/type-guards'

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
  const subscriptions = await prisma.subscription.findMany({
    where: {
      stripeSubscriptionId: { in: subscriptionIds },
      stripeAccountType: program === 'MAHAD_PROGRAM' ? 'MAHAD' : 'DUGSI',
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
 * Build an OrphanedSubscription object from a Stripe subscription
 * Uses type-safe helpers for customer ID and period date extraction
 * Returns null if customer ID is invalid (should be filtered out)
 */
function buildOrphanedSubscriptionObject(
  sub: Stripe.Subscription,
  program: 'MAHAD' | 'DUGSI',
  customerSubscriptionCount?: Map<string, number>
): OrphanedSubscription | null {
  const customer = sub.customer as Stripe.Customer
  const customerId = extractCustomerId(sub.customer)

  if (!customerId) {
    // Skip subscriptions with invalid customer IDs to prevent silent failures
    console.warn(
      `[link-subscriptions] Skipping subscription ${sub.id} - invalid customer ID`
    )
    return null
  }

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
  // Filter out subscriptions with invalid customer IDs
  const orphanedSubs: OrphanedSubscription[] = []
  for (const sub of activeSubscriptions) {
    if (!linkedIds.has(sub.id)) {
      const orphanedSub = buildOrphanedSubscriptionObject(
        sub,
        program,
        customerSubCount
      )
      // Only include subscriptions with valid customer IDs
      if (orphanedSub) {
        orphanedSubs.push(orphanedSub)
      }
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
  try {
    const prismaProgram =
      program === 'MAHAD' ? 'MAHAD_PROGRAM' : 'DUGSI_PROGRAM'

    const { profiles } = await getProgramProfiles({
      program: prismaProgram,
      search: query,
      limit: 50,
    })

    // Get billing assignments to check subscription status
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
        program: prismaProgram,
      })
    }

    return matches
  } catch (error) {
    console.error('[SEARCH_STUDENTS] Error:', error)
    return []
  }
}

/**
 * Get potential student matches for a subscription based on email
 */
export async function getPotentialMatches(
  email: string | null,
  program: 'MAHAD' | 'DUGSI'
): Promise<StudentMatch[]> {
  if (!email) {
    return []
  }

  try {
    const prismaProgram =
      program === 'MAHAD' ? 'MAHAD_PROGRAM' : 'DUGSI_PROGRAM'

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
  } catch (error) {
    console.error('[GET_POTENTIAL_MATCHES] Error:', error)
    return []
  }
}

/**
 * Link a subscription to a program profile
 */
export async function linkSubscriptionToProfile(
  subscriptionId: string,
  profileId: string,
  program: 'MAHAD' | 'DUGSI'
): Promise<{ success: boolean; error?: string }> {
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

    // Get the appropriate Stripe client
    const stripeClient =
      program === 'MAHAD' ? getProductionStripeClient() : getDugsiStripeClient()

    // Retrieve subscription from Stripe
    const stripeSubscription = await stripeClient.subscriptions.retrieve(
      subscriptionId,
      { expand: ['customer'] }
    )

    const customerId = extractCustomerId(stripeSubscription.customer)
    if (!customerId) {
      return { success: false, error: 'Invalid customer ID in subscription' }
    }

    // Get or create billing account
    const accountType = program === 'MAHAD' ? 'MAHAD' : 'DUGSI'
    const personId = profile.personId

    // Find primary contact point for billing account
    const primaryEmail = profile.person.contactPoints.find(
      (cp) => cp.type === 'EMAIL'
    )

    const billingAccount = await upsertBillingAccount({
      personId,
      accountType,
      ...(program === 'MAHAD'
        ? { stripeCustomerIdMahad: customerId }
        : { stripeCustomerIdDugsi: customerId }),
      primaryContactPointId: primaryEmail?.id || null,
    })

    // Get subscription amount
    const amount = stripeSubscription.items.data[0]?.price.unit_amount || 0
    const currency = stripeSubscription.items.data[0]?.price.currency || 'usd'
    const interval =
      stripeSubscription.items.data[0]?.price.recurring?.interval || 'month'

    // Get period dates
    const periodDates = extractPeriodDates(stripeSubscription)

    // Create or update subscription
    let subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    })

    if (!subscription) {
      subscription = await createSubscription({
        billingAccountId: billingAccount.id,
        stripeAccountType: accountType,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        status:
          (stripeSubscription.status as SubscriptionStatus) || 'incomplete',
        amount,
        currency,
        interval,
        currentPeriodStart: periodDates.periodStart,
        currentPeriodEnd: periodDates.periodEnd,
      })
    } else {
      // Update existing subscription
      subscription = await updateSubscriptionStatus(
        subscription.id,
        (stripeSubscription.status as SubscriptionStatus) || 'incomplete',
        {
          currentPeriodStart: periodDates.periodStart,
          currentPeriodEnd: periodDates.periodEnd,
        }
      )
    }

    // Create billing assignment
    await createBillingAssignment({
      subscriptionId: subscription.id,
      programProfileId: profileId,
      amount,
      percentage: null,
      notes: `Linked via admin interface`,
    })

    revalidatePath('/admin/link-subscriptions')

    return { success: true }
  } catch (error) {
    console.error('[LINK_SUBSCRIPTION] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Link a subscription to a student (legacy function name for backward compatibility)
 * @deprecated Use linkSubscriptionToProfile instead
 */
export async function linkSubscriptionToStudent(
  subscriptionId: string,
  studentId: string,
  program: 'MAHAD' | 'DUGSI'
): Promise<{ success: boolean; error?: string }> {
  return linkSubscriptionToProfile(subscriptionId, studentId, program)
}
