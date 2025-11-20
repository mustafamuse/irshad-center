import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { stripeServerClient } from '@/lib/stripe'

// This endpoint should be called by a cron job (e.g., daily)
export async function POST(req: Request) {
  try {
    // Verify authorization (use a secret key for cron jobs)
    const authHeader = req.headers.get('authorization')
    if (
      !authHeader ||
      !authHeader.startsWith('Bearer ') ||
      authHeader.split(' ')[1] !== process.env.CRON_SECRET_KEY
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the cutoff time (24 hours ago)
    const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60

    // Find customers with enrollmentPending=true created more than 24 hours ago
    const abandonedCustomers = await stripeServerClient.customers.list({
      created: { lt: oneDayAgo },
      limit: 100,
    })

    console.log(
      `Found ${abandonedCustomers.data.length} customers to check for abandonment`
    )

    const results = {
      checked: 0,
      abandoned: 0,
      cleaned: 0,
      errors: 0,
      details: [] as any[],
    }

    for (const customer of abandonedCustomers.data) {
      results.checked++

      try {
        // Check if this is a pending enrollment
        if (customer.metadata?.enrollmentPending !== 'true') {
          continue
        }

        // Check if this customer has any subscriptions
        const subscriptions = await stripeServerClient.subscriptions.list({
          customer: customer.id,
          limit: 1,
        })

        if (subscriptions.data.length > 0) {
          // This customer has subscriptions, so it's not abandoned
          continue
        }

        // TODO: Migrate to ProgramProfile/BillingAssignment model - Student model removed
        // Check if this customer exists in our database
        const subscription = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customer.id },
        })

        if (subscription) {
          // This customer exists in our database, so it's not abandoned
          continue
        }

        // This is an abandoned enrollment - log it
        results.abandoned++
        console.log(
          `Found abandoned customer: ${customer.id} (${customer.email})`
        )

        // Add to details
        results.details.push({
          id: customer.id,
          email: customer.email,
          name: customer.name,
          created: new Date(customer.created * 1000).toISOString(),
          metadata: customer.metadata,
        })

        // Update the customer metadata to mark it as abandoned
        await stripeServerClient.customers.update(customer.id, {
          metadata: {
            ...customer.metadata,
            enrollmentPending: 'false',
            enrollmentAbandoned: 'true',
            abandonedAt: new Date().toISOString(),
          },
        })

        results.cleaned++
      } catch (error) {
        console.error(`Error processing customer ${customer.id}:`, error)
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    console.error('Error in cleanup-abandoned-enrollments:', error)
    return NextResponse.json(
      { error: 'Failed to clean up abandoned enrollments' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
