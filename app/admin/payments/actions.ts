'use server'

import { revalidatePath } from 'next/cache'

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
  'use server'
  console.log('Starting Stripe payments backfill from Server Action...')
  try {
    const allStudents = await prisma.student.findMany({
      where: {
        stripeSubscriptionId: { not: null },
        Batch: {
          name: { not: 'Test' },
        },
      },
      select: { id: true, name: true, stripeSubscriptionId: true },
    })

    // Create array of valid subscription IDs
    const subscriptionIds: string[] = []
    const studentsBySubId: Record<
      string,
      Array<{ id: string; name: string; stripeSubscriptionId: string | null }>
    > = {}

    for (const student of allStudents) {
      const subId = student.stripeSubscriptionId
      if (subId) {
        if (!subscriptionIds.includes(subId)) {
          subscriptionIds.push(subId)
          studentsBySubId[subId] = []
        }
        studentsBySubId[subId].push(student)
      }
    }

    let totalInvoicesProcessed = 0

    for (const subId of subscriptionIds) {
      const studentsOnThisSub = studentsBySubId[subId]

      let invoices
      try {
        invoices = await stripeServerClient.invoices.list({
          subscription: subId,
          status: 'paid',
          limit: 100,
          expand: ['data.lines.data'],
        })
      } catch (err: any) {
        if (err?.raw?.code === 'resource_missing') {
          console.warn(
            `Skipping subscription ${subId}: not found in this Stripe mode.`
          )
          continue
        }
        console.error(`Error fetching invoices for sub ${subId}:`, err)
        continue
      }

      for (const invoice of invoices.data) {
        const totalAmountPaid = invoice.amount_paid
        const paidAt = invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(invoice.created * 1000)

        const subLineItem = invoice.lines.data.find(
          (line) =>
            line.parent?.type === 'subscription_item_details' && line.period
        )

        if (!subLineItem) {
          continue
        }

        const periodStart = new Date(subLineItem.period.start * 1000)
        const year = periodStart.getUTCFullYear()
        const month = periodStart.getUTCMonth() + 1

        const amountPerStudent =
          studentsOnThisSub.length > 0
            ? Math.floor(totalAmountPaid / studentsOnThisSub.length)
            : totalAmountPaid

        for (const student of studentsOnThisSub) {
          if (!invoice.id) continue // Skip if invoice ID is missing

          await prisma.studentPayment.upsert({
            where: {
              studentId_stripeInvoiceId: {
                studentId: student.id,
                stripeInvoiceId: invoice.id,
              },
            },
            update: { amountPaid: amountPerStudent, paidAt, year, month },
            create: {
              studentId: student.id,
              stripeInvoiceId: invoice.id,
              year,
              month,
              amountPaid: amountPerStudent,
              paidAt,
            },
          })
        }
        totalInvoicesProcessed++
      }
    }

    console.log(
      `✅ Backfill complete. Processed ${totalInvoicesProcessed} invoices.`
    )
    revalidatePath('/admin/payments')
    return {
      success: true,
      message: `Successfully processed ${totalInvoicesProcessed} invoices across ${subscriptionIds.length} subscriptions.`,
    }
  } catch (error: any) {
    console.error('Failed to execute backfill server action:', error)
    return {
      success: false,
      message: `An error occurred: ${error.message}`,
    }
  }
}
