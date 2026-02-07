/**
 * Billing Query Functions
 *
 * Query functions for BillingAccount, Subscription, and BillingAssignment.
 */

import { Prisma, StripeAccountType, SubscriptionStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

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
      status: {
        in: ['active', 'trialing', 'past_due'],
      },
    },
    relationLoadStrategy: 'join',
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
    primaryContactPointId?: string | null
  },
  client: DatabaseClient = prisma
) {
  // Include relations to match getBillingAccountByStripeCustomerId
  const includeRelations = {
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
  }

  // Try to find existing account
  const existing = await client.billingAccount.findFirst({
    where: {
      personId: data.personId || undefined,
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
        primaryContactPointId:
          data.primaryContactPointId ?? existing.primaryContactPointId,
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
      primaryContactPointId: data.primaryContactPointId,
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
  return client.subscription.create({
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
 * Create billing assignment
 * @param client - Optional database client (for transaction support)
 */
export async function createBillingAssignment(
  data: {
    subscriptionId: string
    programProfileId: string
    amount: number
    percentage?: number | null
    notes?: string | null
  },
  client: DatabaseClient = prisma
) {
  return client.billingAssignment.create({
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
            include: {
              person: {
                include: {
                  contactPoints: true,
                },
              },
            },
          },
        },
      },
      programProfile: {
        include: {
          person: true,
        },
      },
    },
    orderBy: {
      startDate: 'desc',
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
          person: {
            include: {
              contactPoints: true,
            },
          },
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

/**
 * Update billing assignment status (activate/deactivate)
 * @param client - Optional database client (for transaction support)
 */
export async function updateBillingAssignmentStatus(
  assignmentId: string,
  isActive: boolean,
  endDate?: Date | null,
  client: DatabaseClient = prisma
) {
  return client.billingAssignment.update({
    where: { id: assignmentId },
    data: {
      isActive,
      endDate: endDate !== undefined ? endDate : isActive ? null : new Date(),
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
