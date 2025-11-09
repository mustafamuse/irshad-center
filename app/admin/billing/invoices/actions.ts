'use server'

import { prisma } from '@/lib/db'
import { stripeServerClient as stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

/**
 * Sync invoices from Stripe
 */
export async function syncInvoicesFromStripe() {
  try {
    console.log('Starting invoice sync from Stripe...')

    // Get all students with Stripe customer IDs
    const students = await prisma.student.findMany({
      where: {
        stripeCustomerId: {
          not: null,
        },
      },
    })

    let totalSynced = 0
    let totalSkipped = 0

    // Iterate through each student
    for (const student of students) {
      if (!student.stripeCustomerId) continue

      // Fetch invoices from Stripe for this customer
      const invoices = await stripe.invoices.list({
        customer: student.stripeCustomerId,
        limit: 100,
        expand: ['data.charge'],
      })

      for (const invoice of invoices.data) {
        // Skip draft invoices
        if (invoice.status === 'draft') {
          totalSkipped++
          continue
        }

        // Extract payment date
        const paidAt = invoice.status === 'paid' && invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : null

        // Extract month and year
        const invoiceDate = new Date((invoice.created || 0) * 1000)
        const month = invoiceDate.getMonth() + 1
        const year = invoiceDate.getFullYear()

        // Check if payment record already exists
        const existingPayment = await prisma.studentPayment.findFirst({
          where: {
            studentId: student.id,
            stripeInvoiceId: invoice.id,
          },
        })

        if (!existingPayment && paidAt) {
          // Create new payment record
          await prisma.studentPayment.create({
            data: {
              id: `${student.id}-${year}-${month}-${invoice.id}`,
              studentId: student.id,
              year,
              month,
              amountPaid: invoice.amount_paid,
              paidAt,
              stripeInvoiceId: invoice.id,
            },
          })
          totalSynced++
        } else if (existingPayment && !existingPayment.paidAt && paidAt) {
          // Update existing payment record if it's now paid
          await prisma.studentPayment.update({
            where: {
              id: existingPayment.id,
            },
            data: {
              amountPaid: invoice.amount_paid,
              paidAt,
            },
          })
          totalSynced++
        } else {
          totalSkipped++
        }
      }
    }

    console.log(`Invoice sync complete. Synced: ${totalSynced}, Skipped: ${totalSkipped}`)

    revalidatePath('/admin/billing/invoices')

    return {
      success: true,
      totalSynced,
      totalSkipped,
      message: `Successfully synced ${totalSynced} invoices from Stripe`,
    }
  } catch (error) {
    console.error('Error syncing invoices from Stripe:', error)
    return {
      success: false,
      error: 'Failed to sync invoices from Stripe',
    }
  }
}

/**
 * Resend an invoice to a customer
 */
export async function resendInvoice(invoiceId: string) {
  try {
    // Send the invoice via Stripe
    await stripe.invoices.sendInvoice(invoiceId)

    revalidatePath('/admin/billing/invoices')

    return {
      success: true,
      message: 'Invoice resent successfully',
    }
  } catch (error) {
    console.error('Error resending invoice:', error)
    return {
      success: false,
      error: 'Failed to resend invoice',
    }
  }
}

/**
 * Mark an invoice as paid manually (for cash/check payments)
 */
export async function markInvoiceAsPaid(
  studentId: string,
  year: number,
  month: number,
  amount: number,
  stripeInvoiceId?: string
) {
  try {
    const paymentId = stripeInvoiceId
      ? `${studentId}-${year}-${month}-${stripeInvoiceId}`
      : `${studentId}-${year}-${month}-manual-${Date.now()}`

    // Check if payment already exists
    const existingPayment = await prisma.studentPayment.findUnique({
      where: { id: paymentId },
    })

    if (existingPayment) {
      // Update existing payment
      await prisma.studentPayment.update({
        where: { id: paymentId },
        data: {
          amountPaid: amount,
          paidAt: new Date(),
        },
      })
    } else {
      // Create new payment record
      await prisma.studentPayment.create({
        data: {
          id: paymentId,
          studentId,
          year,
          month,
          amountPaid: amount,
          paidAt: new Date(),
          stripeInvoiceId,
        },
      })
    }

    revalidatePath('/admin/billing/invoices')

    return {
      success: true,
      message: 'Invoice marked as paid',
    }
  } catch (error) {
    console.error('Error marking invoice as paid:', error)
    return {
      success: false,
      error: 'Failed to mark invoice as paid',
    }
  }
}

/**
 * Get invoice details from Stripe
 */
export async function getInvoiceDetails(invoiceId: string) {
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ['customer', 'subscription', 'charge'],
    })

    return {
      success: true,
      invoice,
    }
  } catch (error) {
    console.error('Error fetching invoice details:', error)
    return {
      success: false,
      error: 'Failed to fetch invoice details',
    }
  }
}