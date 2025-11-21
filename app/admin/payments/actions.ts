'use server'

import { revalidatePath } from 'next/cache'

import type Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { stripeServerClient } from '@/lib/stripe'

export async function getBatchesForFilter() {
  try {
    const batches = await prisma.batch.findMany({
      select: {
        id: true,
        name: true,
      },
      where: {
        name: {
          not: 'Test',
        },
      },
      orderBy: {
        name: 'asc',
      },
    })
    return batches
  } catch (error) {
    console.error('Failed to fetch batches:', error)
    return []
  }
}

export async function runPaymentsBackfill() {
  try {
    let processedCount = 0
    let skippedCount = 0
    let errorCount = 0

    // Fetch all paid invoices from Stripe
    const invoices: Stripe.Invoice[] = []
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const response = await stripeServerClient.invoices.list({
        limit: 100,
        status: 'paid',
        starting_after: startingAfter,
        expand: ['data.subscription', 'data.customer'],
      })

      invoices.push(...response.data)
      hasMore = response.has_more
      startingAfter = response.data[response.data.length - 1]?.id
    }

    console.log(`[PAYMENTS_BACKFILL] Found ${invoices.length} paid invoices`)

    // Process each invoice
    for (const invoice of invoices) {
      try {
        // Skip if no invoice ID
        if (!invoice.id) {
          skippedCount++
          continue
        }

        // Skip if no subscription
        // Invoice.subscription can be string ID, Subscription object, or null
        // Type assertion needed due to Stripe API version differences
        const stripeSubscription = (
          invoice as unknown as {
            subscription?: string | Stripe.Subscription | null
          }
        ).subscription as string | Stripe.Subscription | null | undefined
        const subscriptionId =
          typeof stripeSubscription === 'string'
            ? stripeSubscription
            : stripeSubscription?.id || null

        if (!subscriptionId) {
          skippedCount++
          continue
        }

        // Find subscription in database
        const subscription = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
          include: {
            assignments: {
              where: { isActive: true },
              include: {
                programProfile: true,
              },
            },
          },
        })

        if (!subscription || subscription.assignments.length === 0) {
          skippedCount++
          continue
        }

        // Extract period info from invoice
        const period = invoice.period_end
          ? new Date(invoice.period_end * 1000)
          : invoice.created
            ? new Date(invoice.created * 1000)
            : new Date()

        const year = period.getFullYear()
        const month = period.getMonth() + 1

        // Create payment records for each active assignment
        // Use assignment.amount (prorated amount) instead of full invoice amount
        for (const assignment of subscription.assignments) {
          // Check if payment already exists
          const existingPayment = await prisma.studentPayment.findUnique({
            where: {
              programProfileId_stripeInvoiceId: {
                programProfileId: assignment.programProfileId,
                stripeInvoiceId: invoice.id,
              },
            },
          })

          if (existingPayment) {
            continue // Skip if already exists
          }

          // Use assignment amount (prorated share) instead of full invoice amount
          // This prevents double-counting revenue when multiple children share a subscription
          const amountPaid = assignment.amount || 0

          // Create payment record
          await prisma.studentPayment.create({
            data: {
              programProfileId: assignment.programProfileId,
              stripeInvoiceId: invoice.id,
              year,
              month,
              amountPaid,
              paidAt: invoice.created
                ? new Date(invoice.created * 1000)
                : new Date(),
            },
          })

          processedCount++
        }
      } catch (error) {
        console.error(
          `[PAYMENTS_BACKFILL] Error processing invoice ${invoice.id}:`,
          error
        )
        errorCount++
      }
    }

    revalidatePath('/admin/payments')

    return {
      success: true,
      message: `Backfill complete: ${processedCount} payments created, ${skippedCount} skipped, ${errorCount} errors`,
    }
  } catch (error) {
    console.error('[PAYMENTS_BACKFILL] Fatal error:', error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unknown error during backfill',
    }
  }
}
