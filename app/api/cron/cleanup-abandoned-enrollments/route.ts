import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { getBillingAccountByStripeCustomerId } from '@/lib/db/queries/billing'
import { updateEnrollmentStatus } from '@/lib/db/queries/enrollment'
import { createCronLogger } from '@/lib/logger'
import { getMahadStripeClient } from '@/lib/stripe-mahad'

const logger = createCronLogger('cleanup-abandoned-enrollments')

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
    const abandonedCustomers = await getMahadStripeClient().customers.list({
      created: { lt: oneDayAgo },
      limit: 100,
    })

    logger.info(
      { count: abandonedCustomers.data.length },
      'Found customers to check for abandonment'
    )

    const results = {
      checked: 0,
      abandoned: 0,
      cleaned: 0,
      errors: 0,
      details: [] as unknown[],
    }

    for (const customer of abandonedCustomers.data) {
      results.checked++

      try {
        // Check if this is a pending enrollment
        if (customer.metadata?.enrollmentPending !== 'true') {
          continue
        }

        // Check if this customer has any subscriptions
        const subscriptions = await getMahadStripeClient().subscriptions.list({
          customer: customer.id,
          limit: 1,
        })

        if (subscriptions.data.length > 0) {
          // This customer has subscriptions, so it's not abandoned
          continue
        }

        // Check if this customer exists in our database (check both MAHAD and DUGSI accounts)
        const mahadBillingAccount = await getBillingAccountByStripeCustomerId(
          customer.id,
          'MAHAD'
        )
        const dugsiBillingAccount = await getBillingAccountByStripeCustomerId(
          customer.id,
          'DUGSI'
        )

        // Check if customer has any active subscriptions in our database
        const hasActiveSubscription =
          mahadBillingAccount?.subscriptions?.some(
            (sub) => sub.status === 'active' || sub.status === 'trialing'
          ) ||
          dugsiBillingAccount?.subscriptions?.some(
            (sub) => sub.status === 'active' || sub.status === 'trialing'
          )

        if (hasActiveSubscription) {
          // This customer has active subscriptions, so it's not abandoned
          continue
        }

        // This is an abandoned enrollment - mark enrollments as withdrawn
        results.abandoned++
        logger.info(
          { customerId: customer.id, email: customer.email },
          'Found abandoned customer'
        )

        // Mark enrollments as withdrawn for profiles linked to this customer
        const billingAccount = mahadBillingAccount || dugsiBillingAccount
        if (billingAccount?.personId) {
          // Get all program profiles for this person
          const profiles = await prisma.programProfile.findMany({
            where: {
              personId: billingAccount.personId,
            },
            include: {
              enrollments: {
                where: {
                  status: { not: 'WITHDRAWN' },
                  endDate: null,
                },
              },
            },
          })

          // Update each active enrollment to WITHDRAWN
          for (const profile of profiles) {
            for (const enrollment of profile.enrollments) {
              await updateEnrollmentStatus(
                enrollment.id,
                'WITHDRAWN',
                'Abandoned enrollment - no payment after 24 hours',
                new Date()
              )

              // Update ProgramProfile status
              await prisma.programProfile.update({
                where: { id: profile.id },
                data: { status: 'WITHDRAWN' },
              })
            }
          }

          logger.info(
            { profileCount: profiles.length, customerId: customer.id },
            'Marked profiles as withdrawn for abandoned customer'
          )
        }

        // Add to details
        results.details.push({
          id: customer.id,
          email: customer.email,
          name: customer.name,
          created: new Date(customer.created * 1000).toISOString(),
          metadata: customer.metadata,
        })

        // Update the customer metadata to mark it as abandoned
        await getMahadStripeClient().customers.update(customer.id, {
          metadata: {
            ...customer.metadata,
            enrollmentPending: 'false',
            enrollmentAbandoned: 'true',
            abandonedAt: new Date().toISOString(),
          },
        })

        results.cleaned++
      } catch (error) {
        logger.error(
          { err: error, customerId: customer.id },
          'Error processing customer'
        )
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error in cleanup-abandoned-enrollments')
    return NextResponse.json(
      { error: 'Failed to clean up abandoned enrollments' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
