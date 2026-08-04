/**
 * Billing Query Functions
 *
 * Query functions for BillingAccount, Subscription, and BillingAssignment.
 */

import { Prisma, StripeAccountType, SubscriptionStatus } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { personMinimalSelect } from '@/lib/db/prisma-helpers'
import { LIVE_SUBSCRIPTION_STATUSES } from '@/lib/db/query-builders'
import { DatabaseClient } from '@/lib/db/types'

// Deliberately narrower than LIVE_SUBSCRIPTION_STATUSES: this fallback only
// covers the "subscription is still live and billing" cases relevant to
// resurrecting a fully-withdrawn family (active/trialing/past_due/paused),
// not incomplete/unpaid states with no assignment history to fall back to.
// trialing is included so a fully-withdrawn family still in its trial gets
// un-canceled on re-enroll instead of being stranded.
const LIVE_FALLBACK_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'active',
  'trialing',
  'past_due',
  'paused',
]

/**
 * Get billing account by person ID and account type
 * @param client - Optional database client (for transaction support)
 */
export async function getBillingAccountByPerson(
  personId: string,
  accountType: StripeAccountType,
  client: DatabaseClient = prisma
) {
  return client.billingAccount.findFirst({
    where: {
      personId,
      accountType,
    },
    relationLoadStrategy: 'join',
    include: {
      person: true,
      subscriptions: {
        where: {
          status: { in: LIVE_SUBSCRIPTION_STATUSES },
        },
        include: {
          assignments: {
            where: { isActive: true },
            include: {
              programProfile: {
                include: {
                  person: personMinimalSelect,
                },
              },
            },
          },
        },
      },
      // TODO: assignments model removed - need to include via ProgramAssignment when ready
    },
  })
}

/**
 * Get billing account by Stripe customer ID
 * @param client - Optional database client (for transaction support)
 */
export async function getBillingAccountByStripeCustomerId(
  stripeCustomerId: string,
  accountType: StripeAccountType,
  client: DatabaseClient = prisma
) {
  const where: Prisma.BillingAccountWhereInput = {}

  switch (accountType) {
    case 'MAHAD':
      where.stripeCustomerIdMahad = stripeCustomerId
      break
    case 'DUGSI':
      where.stripeCustomerIdDugsi = stripeCustomerId
      break
    case 'YOUTH_EVENTS':
      where.stripeCustomerIdYouth = stripeCustomerId
      break
    case 'GENERAL_DONATION':
      where.stripeCustomerIdDonation = stripeCustomerId
      break
  }

  return client.billingAccount.findFirst({
    where,
    relationLoadStrategy: 'join',
    include: {
      person: true,
      subscriptions: {
        include: {
          assignments: {
            where: { isActive: true },
            include: {
              programProfile: {
                include: {
                  person: personMinimalSelect,
                },
              },
            },
          },
        },
      },
    },
  })
}

/**
 * Get subscription by Stripe subscription ID
 * @param client - Optional database client (for transaction support)
 */
export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string,
  client: DatabaseClient = prisma
) {
  return client.subscription.findUnique({
    where: { stripeSubscriptionId },
    relationLoadStrategy: 'join',
    include: {
      billingAccount: {
        include: {
          person: true,
        },
      },
      assignments: {
        where: { isActive: true },
        include: {
          programProfile: {
            include: {
              person: personMinimalSelect,
              enrollments: {
                where: {
                  status: { not: 'WITHDRAWN' },
                  endDate: null,
                },
              },
            },
          },
        },
      },
      history: {
        orderBy: {
          processedAt: 'desc',
        },
        take: 10,
      },
    },
  })
}

/**
 * Get orphaned subscriptions (subscriptions without active assignments)
 * @param client - Optional database client (for transaction support)
 */
export async function getOrphanedSubscriptions(
  accountType?: StripeAccountType,
  client: DatabaseClient = prisma
) {
  return client.subscription.findMany({
    where: {
      ...(accountType ? { stripeAccountType: accountType } : {}),
      assignments: {
        none: {
          isActive: true,
        },
      },
      status: { in: LIVE_SUBSCRIPTION_STATUSES },
    },
    relationLoadStrategy: 'join',
    include: {
      billingAccount: {
        include: {
          person: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

/**
 * Find a billing account by person ID and account type (no relations).
 * @param client - Optional database client (for transaction support)
 */
export async function findBillingAccountByPersonAndType(
  personId: string,
  accountType: StripeAccountType,
  client: DatabaseClient = prisma
) {
  return client.billingAccount.findFirst({
    where: { personId, accountType },
  })
}

/**
 * Create a billing account (no relations returned).
 * @param client - Optional database client (for transaction support)
 */
export async function createBillingAccountMinimal(
  data: { personId: string; accountType: StripeAccountType },
  client: DatabaseClient = prisma
) {
  return client.billingAccount.create({ data })
}

/**
 * Get a subscription by ID with id/amount/status only.
 * @param client - Optional database client (for transaction support)
 */
export async function getSubscriptionById(
  subscriptionId: string,
  client: DatabaseClient = prisma
) {
  return client.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      amount: true,
      status: true,
    },
  })
}

/**
 * Create or update billing account
 * @param client - Optional database client (for transaction support)
 */
export async function upsertBillingAccount(
  data: {
    personId?: string | null
    accountType: StripeAccountType
    stripeCustomerIdMahad?: string | null
    stripeCustomerIdDugsi?: string | null
    stripeCustomerIdYouth?: string | null
    stripeCustomerIdDonation?: string | null
    paymentIntentIdDugsi?: string | null
    paymentMethodCaptured?: boolean
    paymentMethodCapturedAt?: Date | null
  },
  client: DatabaseClient = prisma
) {
  // Include relations to match getBillingAccountByStripeCustomerId
  const includeRelations = {
    person: true as const,
    subscriptions: {
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            programProfile: {
              include: {
                person: personMinimalSelect,
              },
            },
          },
        },
      },
    },
  }

  // Try to find existing account
  const existing = await client.billingAccount.findFirst({
    where: {
      ...(data.personId ? { personId: data.personId } : {}),
      accountType: data.accountType,
    },
  })

  if (existing) {
    return client.billingAccount.update({
      where: { id: existing.id },
      data: {
        stripeCustomerIdMahad:
          data.stripeCustomerIdMahad ?? existing.stripeCustomerIdMahad,
        stripeCustomerIdDugsi:
          data.stripeCustomerIdDugsi ?? existing.stripeCustomerIdDugsi,
        stripeCustomerIdYouth:
          data.stripeCustomerIdYouth ?? existing.stripeCustomerIdYouth,
        stripeCustomerIdDonation:
          data.stripeCustomerIdDonation ?? existing.stripeCustomerIdDonation,
        paymentIntentIdDugsi:
          data.paymentIntentIdDugsi ?? existing.paymentIntentIdDugsi,
        paymentMethodCaptured:
          data.paymentMethodCaptured ?? existing.paymentMethodCaptured,
        paymentMethodCapturedAt:
          data.paymentMethodCapturedAt ?? existing.paymentMethodCapturedAt,
      },
      include: includeRelations,
    })
  }

  return client.billingAccount.create({
    data: {
      personId: data.personId,
      accountType: data.accountType,
      stripeCustomerIdMahad: data.stripeCustomerIdMahad,
      stripeCustomerIdDugsi: data.stripeCustomerIdDugsi,
      stripeCustomerIdYouth: data.stripeCustomerIdYouth,
      stripeCustomerIdDonation: data.stripeCustomerIdDonation,
      paymentIntentIdDugsi: data.paymentIntentIdDugsi,
      paymentMethodCaptured: data.paymentMethodCaptured ?? false,
      paymentMethodCapturedAt: data.paymentMethodCapturedAt,
    },
    include: includeRelations,
  })
}

/**
 * Create subscription
 * @param client - Optional database client (for transaction support)
 */
export async function createSubscription(
  data: {
    billingAccountId: string
    stripeAccountType: StripeAccountType
    stripeSubscriptionId: string
    stripeCustomerId: string
    status?: SubscriptionStatus
    amount: number
    currency?: string
    interval?: string
    currentPeriodStart?: Date | null
    currentPeriodEnd?: Date | null
    paidUntil?: Date | null
    lastPaymentDate?: Date | null
    previousSubscriptionIds?: string[]
  },
  client: DatabaseClient = prisma
) {
  // Upsert instead of create: concurrent deliveries of the same subscription
  // (event redelivery, created/checkout races) must not abort on P2002.
  return client.subscription.upsert({
    where: { stripeSubscriptionId: data.stripeSubscriptionId },
    create: {
      billingAccountId: data.billingAccountId,
      stripeAccountType: data.stripeAccountType,
      stripeSubscriptionId: data.stripeSubscriptionId,
      stripeCustomerId: data.stripeCustomerId,
      status: data.status || 'incomplete',
      amount: data.amount,
      currency: data.currency || 'usd',
      interval: data.interval || 'month',
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      paidUntil: data.paidUntil,
      lastPaymentDate: data.lastPaymentDate,
      previousSubscriptionIds: data.previousSubscriptionIds || [],
    },
    update: {
      // No 'incomplete' default here: a late create delivery must not
      // downgrade a status another event already advanced.
      ...(data.status ? { status: data.status } : {}),
      amount: data.amount,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      paidUntil: data.paidUntil,
    },
    include: {
      billingAccount: {
        include: {
          person: true,
        },
      },
      assignments: {
        where: { isActive: true },
        include: {
          programProfile: {
            include: {
              person: personMinimalSelect,
              enrollments: {
                where: {
                  status: { not: 'WITHDRAWN' },
                  endDate: null,
                },
              },
            },
          },
        },
      },
      history: {
        orderBy: {
          processedAt: 'desc',
        },
        take: 10,
      },
    },
  })
}

/**
 * Update subscription status
 * @param client - Optional database client (for transaction support)
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
  updates?: {
    currentPeriodStart?: Date | null
    currentPeriodEnd?: Date | null
    paidUntil?: Date | null
    lastPaymentDate?: Date | null
  },
  client: DatabaseClient = prisma
) {
  return client.subscription.update({
    where: { id: subscriptionId },
    data: {
      status,
      ...updates,
    },
    include: {
      billingAccount: {
        include: {
          person: true,
        },
      },
      assignments: {
        where: { isActive: true },
        include: {
          programProfile: {
            include: {
              person: personMinimalSelect,
              enrollments: {
                where: {
                  status: { not: 'WITHDRAWN' },
                  endDate: null,
                },
              },
            },
          },
        },
      },
      history: {
        orderBy: {
          processedAt: 'desc',
        },
        take: 10,
      },
    },
  })
}

/**
 * Get active billing assignments for a subscription
 * @param client - Optional database client (for transaction support)
 */
export async function getActiveBillingAssignmentsForSubscription(
  subscriptionId: string,
  client: DatabaseClient = prisma
): Promise<{ id: string; programProfileId: string; amount: number }[]> {
  return client.billingAssignment.findMany({
    where: { subscriptionId, isActive: true },
    select: { id: true, programProfileId: true, amount: true },
  })
}

/**
 * Create billing assignment
 * @param client - Optional database client (for transaction support)
 */
export async function createBillingAssignment(
  data: { subscriptionId: string; programProfileId: string; amount: number },
  client: DatabaseClient = prisma
): Promise<{ id: string }> {
  return client.billingAssignment.create({
    data: { ...data, isActive: true },
    select: { id: true },
  })
}

/**
 * Deactivate billing assignment
 * @param client - Optional database client (for transaction support)
 */
export async function deactivateBillingAssignment(
  assignmentId: string,
  client: DatabaseClient = prisma
) {
  return client.billingAssignment.update({
    where: { id: assignmentId },
    data: {
      isActive: false,
      endDate: new Date(),
    },
  })
}

/**
 * Deactivate all active billing assignments for a set of program profiles
 * @param client - Optional database client (for transaction support)
 */
export async function deactivateBillingAssignmentsForProfiles(
  profileIds: string[],
  endDate: Date,
  client: DatabaseClient = prisma
) {
  return client.billingAssignment.updateMany({
    where: {
      programProfileId: { in: profileIds },
      isActive: true,
    },
    data: {
      isActive: false,
      endDate,
    },
  })
}

/**
 * Reactivate billing assignments previously deactivated with the given
 * endDate sentinel (compensating rollback for a failed withdrawal)
 * @param client - Optional database client (for transaction support)
 */
export async function reactivateBillingAssignmentsForProfiles(
  profileIds: string[],
  endDate: Date,
  client: DatabaseClient = prisma
) {
  return client.billingAssignment.updateMany({
    where: {
      programProfileId: { in: profileIds },
      isActive: false,
      endDate,
    },
    data: {
      isActive: true,
      endDate: null,
    },
  })
}

/**
 * Get active billing assignments on a subscription for a set of profiles
 * @param client - Optional database client (for transaction support)
 */
export async function getActiveBillingAssignmentsForProfiles(
  profileIds: string[],
  subscriptionId: string,
  client: DatabaseClient = prisma
) {
  return client.billingAssignment.findMany({
    where: {
      programProfileId: { in: profileIds },
      subscriptionId,
      isActive: true,
    },
    select: { id: true, amount: true },
  })
}

/**
 * Update the amount on a single billing assignment
 * @param client - Optional database client (for transaction support)
 */
export async function updateBillingAssignmentAmount(
  assignmentId: string,
  amount: number,
  client: DatabaseClient = prisma
) {
  return client.billingAssignment.update({
    where: { id: assignmentId },
    data: { amount },
  })
}

/**
 * Update the stored amount on a subscription row
 * @param client - Optional database client (for transaction support)
 */
export async function updateSubscriptionAmount(
  subscriptionId: string,
  amount: number,
  client: DatabaseClient = prisma
) {
  return client.subscription.update({
    where: { id: subscriptionId },
    data: { amount },
  })
}

/**
 * Add subscription history entry
 * @param client - Optional database client (for transaction support)
 */
export async function addSubscriptionHistory(
  data: {
    subscriptionId: string
    eventType: string
    eventId: string
    status: SubscriptionStatus
    amount?: number | null
    metadata?: Record<string, unknown> | null
  },
  client: DatabaseClient = prisma
) {
  return client.subscriptionHistory.create({
    data: {
      subscriptionId: data.subscriptionId,
      eventType: data.eventType,
      eventId: data.eventId,
      status: data.status,
      amount: data.amount,
      metadata: data.metadata
        ? (data.metadata as Prisma.InputJsonValue)
        : undefined,
    },
  })
}

/**
 * Get billing assignments by program profile
 *
 * Note: billingAccount select is scoped to Dugsi fields (stripeCustomerIdDugsi).
 * If reused for Mahad, expand the select to include stripeCustomerIdMahad.
 *
 * @param client - Optional database client (for transaction support)
 */
export async function getBillingAssignmentsByProfile(
  profileId: string,
  client: DatabaseClient = prisma
) {
  return client.billingAssignment.findMany({
    where: {
      programProfileId: profileId,
      isActive: true,
    },
    relationLoadStrategy: 'join',
    include: {
      subscription: {
        include: {
          billingAccount: {
            select: {
              id: true,
              paymentMethodCaptured: true,
              stripeCustomerIdDugsi: true,
            },
          },
        },
      },
      programProfile: {
        include: {
          person: personMinimalSelect,
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}

/**
 * Find a family's still-live Dugsi subscriptions via ANY billing assignment
 * (active or not), not just an active one. Used as a fallback when a family
 * has no active assignment (e.g. every child was withdrawn) but Stripe still
 * has a subscription with cancel_at_period_end pending.
 * @client - Optional database client (for transaction support)
 */
export async function findFamilyLiveSubscriptions(
  familyReferenceId: string,
  client: DatabaseClient = prisma
) {
  const assignments = await client.billingAssignment.findMany({
    where: {
      programProfile: {
        familyReferenceId,
        program: DUGSI_PROGRAM,
      },
      subscription: {
        stripeAccountType: StripeAccountType.DUGSI,
        status: { in: LIVE_FALLBACK_SUBSCRIPTION_STATUSES },
      },
    },
    distinct: ['subscriptionId'],
    include: { subscription: true },
    orderBy: { createdAt: 'desc' },
  })

  return assignments.map((a) => a.subscription)
}

/**
 * Update a subscription's status only, returning the bare row (no relations).
 * Distinct from updateSubscriptionStatus, which also updates period fields
 * and returns billingAccount/assignments/history relations.
 * @param client - Optional database client (for transaction support)
 */
export async function updateSubscriptionStatusOnly(
  subscriptionId: string,
  status: SubscriptionStatus,
  client: DatabaseClient = prisma
) {
  return client.subscription.update({
    where: { id: subscriptionId },
    data: { status },
  })
}

/**
 * Update a subscription's billing account, status, amount, and period fields
 * during admin consolidation. Returns the bare row (no relations).
 * @param client - Optional database client (for transaction support)
 */
export async function updateSubscriptionForConsolidation(
  subscriptionId: string,
  data: {
    billingAccountId: string
    status: SubscriptionStatus
    amount: number
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    paidUntil: Date | null
  },
  client: DatabaseClient = prisma
) {
  return client.subscription.update({
    where: { id: subscriptionId },
    data,
  })
}

/**
 * Find a parent (by email) with their Dugsi billing account and most recent
 * live subscription, for the Dugsi payment-status lookup by parent email.
 * @param client - Optional database client (for transaction support)
 */
export async function findParentWithDugsiBillingAccount(
  normalizedEmail: string,
  client: DatabaseClient = prisma
) {
  return client.person.findFirst({
    where: {
      email: normalizedEmail,
    },
    include: {
      billingAccounts: {
        where: {
          accountType: 'DUGSI',
        },
        include: {
          subscriptions: {
            where: {
              status: { in: LIVE_SUBSCRIPTION_STATUSES },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      },
    },
  })
}

/**
 * Get billing assignments by subscription
 * @param client - Optional database client (for transaction support)
 */
export async function getBillingAssignmentsBySubscription(
  subscriptionId: string,
  client: DatabaseClient = prisma
) {
  return client.billingAssignment.findMany({
    where: {
      subscriptionId,
    },
    relationLoadStrategy: 'join',
    include: {
      programProfile: {
        include: {
          person: true,
          enrollments: {
            where: {
              status: { not: 'WITHDRAWN' },
              endDate: null,
            },
            include: {
              batch: true,
            },
          },
        },
      },
      subscription: {
        include: {
          billingAccount: true,
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}
