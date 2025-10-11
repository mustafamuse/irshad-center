import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // 'all', 'with-subscription', 'without-subscription'

    // Base query to get all students with their subscription information
    let whereClause = {}

    switch (filter) {
      case 'with-subscription':
        whereClause = { stripeSubscriptionId: { not: null } }
        break
      case 'without-subscription':
        whereClause = { stripeSubscriptionId: null }
        break
      default:
        // 'all' - no filter
        break
    }

    // Get students with applied filters
    const students = await prisma.student.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        subscriptionStatus: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
        batchId: true,
        Batch: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    })

    // Calculate summary statistics
    const totalStudents = students.length
    const withSubscription = students.filter(
      (s) => s.stripeSubscriptionId
    ).length
    const withoutSubscription = totalStudents - withSubscription
    const withStripeCustomer = students.filter((s) => s.stripeCustomerId).length
    const withoutStripeCustomer = totalStudents - withStripeCustomer

    // Group students by subscription status
    const activeSubscriptions = students.filter(
      (s) => s.subscriptionStatus === 'active'
    )
    const inactiveSubscriptions = students.filter(
      (s) => s.subscriptionStatus && s.subscriptionStatus !== 'active'
    )
    const noSubscription = students.filter((s) => !s.stripeSubscriptionId)

    return NextResponse.json({
      summary: {
        totalStudents,
        withSubscription,
        withoutSubscription,
        withStripeCustomer,
        withoutStripeCustomer,
        activeSubscriptions: activeSubscriptions.length,
        inactiveSubscriptions: inactiveSubscriptions.length,
        noSubscription: noSubscription.length,
      },
      Student: {
        active: activeSubscriptions,
        inactive: inactiveSubscriptions,
        none: noSubscription,
      },
      allStudents: students,
    })
  } catch (error) {
    console.error('Failed to fetch student payers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch student payers' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
