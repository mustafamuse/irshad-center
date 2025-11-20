/**
 * Billing Query Functions
 *
 * Query functions for BillingAccount, Subscription, and BillingAssignment.
 */

import { Prisma, StripeAccountType, SubscriptionStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import { getStripeCustomerId } from '@/lib/types/billing'

/**
 * Get billing account by person ID and account type
 */
export async function getBillingAccountByPerson(
  personId: string,
  accountType: StripeAccountType
) {
  return prisma.billingAccount.findFirst({
    where: {
      personId,
      accountType,
    },
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      subscriptions: {
        where: {
          status: { in: ['active', 'trialing', 'past_due'] },
        },
        include: {
          assignments: {
            where: { isActive: true },
            include: {
              programProfile: {
                include: {
                  person: true,
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
 */
export async function getBillingAccountByStripeCustomerId(
  stripeCustomerId: string,
  accountType: StripeAccountType
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

  return prisma.billingAccount.findFirst({
    where,
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      subscriptions: {
        include: {
          assignments: {
            where: { isActive: true },
            include: {
              programProfile: {
                include: {
                  person: true,
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
 */
export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string
) {
  return prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: {
      billingAccount: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
        },
      },
      assignments: {
        where: { isActive: true },
        include: {
          programProfile: {
            include: {
              person: true,
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
 */
export async function getOrphanedSubscriptions(
  accountType?: StripeAccountType
) {
  return prisma.subscription.findMany({
    where: {
      ...(accountType ? { stripeAccountType: accountType } : {}),
      assignments: {
        none: {
          isActive: true,
        },
      },
      status: {
        in: ['active', 'trialing', 'past_due'],
      },
    },
    include: {
      billingAccount: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

/**
 * Create or update billing account
 */
export async function upsertBillingAccount(data: {
  personId?: string | null
  accountType: StripeAccountType
  stripeCustomerIdMahad?: string | null
  stripeCustomerIdDugsi?: string | null
  stripeCustomerIdYouth?: string | null
  stripeCustomerIdDonation?: string | null
  paymentIntentIdDugsi?: string | null
  paymentMethodCaptured?: boolean
  paymentMethodCapturedAt?: Date | null
  primaryContactPointId?: string | null
}) {
  // Try to find existing account
  const existing = await prisma.billingAccount.findFirst({
    where: {
      personId: data.personId || undefined,
      accountType: data.accountType,
    },
  })

  if (existing) {
    return prisma.billingAccount.update({
      where: { id: existing.id },
      data: {
        stripeCustomerIdMahad: data.stripeCustomerIdMahad ?? existing.stripeCustomerIdMahad,
        stripeCustomerIdDugsi: data.stripeCustomerIdDugsi ?? existing.stripeCustomerIdDugsi,
        stripeCustomerIdYouth: data.stripeCustomerIdYouth ?? existing.stripeCustomerIdYouth,
        stripeCustomerIdDonation: data.stripeCustomerIdDonation ?? existing.stripeCustomerIdDonation,
        paymentIntentIdDugsi: data.paymentIntentIdDugsi ?? existing.paymentIntentIdDugsi,
        paymentMethodCaptured: data.paymentMethodCaptured ?? existing.paymentMethodCaptured,
        paymentMethodCapturedAt: data.paymentMethodCapturedAt ?? existing.paymentMethodCapturedAt,
        primaryContactPointId: data.primaryContactPointId ?? existing.primaryContactPointId,
      },
    })
  }

  return prisma.billingAccount.create({
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
      primaryContactPointId: data.primaryContactPointId,
    },
  })
}

/**
 * Create subscription
 */
export async function createSubscription(data: {
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
}) {
  return prisma.subscription.create({
    data: {
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
    include: {
      billingAccount: true,
    },
  })
}

/**
 * Update subscription status
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
  updates?: {
    currentPeriodStart?: Date | null
    currentPeriodEnd?: Date | null
    paidUntil?: Date | null
    lastPaymentDate?: Date | null
  }
) {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status,
      ...updates,
    },
  })
}

/**
 * Create billing assignment
 */
export async function createBillingAssignment(data: {
  subscriptionId: string
  programProfileId: string
  amount: number
  percentage?: number | null
  notes?: string | null
}) {
  return prisma.billingAssignment.create({
    data: {
      subscriptionId: data.subscriptionId,
      programProfileId: data.programProfileId,
      amount: data.amount,
      percentage: data.percentage,
      notes: data.notes,
      isActive: true,
    },
    include: {
      subscription: true,
      programProfile: {
        include: {
          person: true,
        },
      },
    },
  })
}

/**
 * Deactivate billing assignment
 */
export async function deactivateBillingAssignment(assignmentId: string) {
  return prisma.billingAssignment.update({
    where: { id: assignmentId },
    data: {
      isActive: false,
      endDate: new Date(),
    },
  })
}

/**
 * Add subscription history entry
 */
export async function addSubscriptionHistory(data: {
  subscriptionId: string
  eventType: string
  eventId: string
  status: SubscriptionStatus
  amount?: number | null
  metadata?: Record<string, unknown> | null
}) {
  return prisma.subscriptionHistory.create({
    data: {
      subscriptionId: data.subscriptionId,
      eventType: data.eventType,
      eventId: data.eventId,
      status: data.status,
      amount: data.amount,
      metadata: (data.metadata as any) ?? undefined,
    },
  })
}



