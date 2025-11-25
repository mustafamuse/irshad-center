import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { createAPILogger } from '@/lib/logger'

const logger = createAPILogger('/api/admin/subscriptions')

export async function GET() {
  try {
    // Get all subscriptions with their assignments
    const subscriptions = await prisma.subscription.findMany({
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
                    batch: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transform to match expected response shape
    const subscriptionsData = subscriptions.map((sub) => {
      const assignments = sub.assignments.map((assignment) => ({
        id: assignment.programProfile.id,
        name: assignment.programProfile.person.name,
        email:
          assignment.programProfile.person.contactPoints.find(
            (cp) => cp.type === 'EMAIL'
          )?.value || '',
        phone:
          assignment.programProfile.person.contactPoints.find(
            (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
          )?.value || null,
        program: assignment.programProfile.program,
        status: assignment.programProfile.status,
        batchId: assignment.programProfile.enrollments[0]?.batchId || null,
        batchName:
          assignment.programProfile.enrollments[0]?.batch?.name || null,
        assignmentAmount: assignment.amount,
        assignmentPercentage: assignment.percentage,
      }))

      return {
        id: sub.id,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        stripeCustomerId: sub.stripeCustomerId,
        status: sub.status,
        amount: sub.amount,
        currency: sub.currency,
        interval: sub.interval,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        paidUntil: sub.paidUntil,
        lastPaymentDate: sub.lastPaymentDate,
        stripeAccountType: sub.stripeAccountType,
        billingAccount: {
          id: sub.billingAccount.id,
          personId: sub.billingAccount.personId,
          email:
            sub.billingAccount.person?.contactPoints.find(
              (cp) => cp.type === 'EMAIL'
            )?.value || '',
        },
        assignments: assignments,
      }
    })

    // Calculate summary stats
    const total = subscriptions.length
    const active = subscriptions.filter(
      (sub) =>
        sub.status === 'active' ||
        sub.status === 'trialing' ||
        sub.status === 'past_due'
    ).length
    const inactive = total - active

    return NextResponse.json({
      subscriptions: subscriptionsData,
      summary: {
        total,
        active,
        inactive,
      },
    })
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error fetching subscriptions'
    )
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch subscriptions',
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
