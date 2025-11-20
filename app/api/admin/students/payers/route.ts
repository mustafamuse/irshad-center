import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  // TODO: Migrate to ProgramProfile/BillingAssignment model - Student model removed
  return NextResponse.json({
    summary: {
      totalStudents: 0,
      withSubscription: 0,
      withoutSubscription: 0,
      withStripeCustomer: 0,
      withoutStripeCustomer: 0,
      activeSubscriptions: 0,
      inactiveSubscriptions: 0,
      noSubscription: 0,
    },
    Student: {
      active: [],
      inactive: [],
      none: [],
    },
    allStudents: [],
  })
}

export const dynamic = 'force-dynamic'
