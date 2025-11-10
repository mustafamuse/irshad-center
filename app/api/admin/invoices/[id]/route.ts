import { NextRequest, NextResponse } from 'next/server'
import { stripeServerClient as stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/invoices/[id] - Get a single invoice details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params

    if (!invoiceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice ID is required',
        },
        { status: 400 }
      )
    }

    // First, try to get the invoice from Stripe
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId, {
        expand: ['customer', 'subscription', 'charge', 'lines.data'],
      })

      // Get the student from our database
      let student = null
      if (invoice.customer && typeof invoice.customer === 'object') {
        student = await prisma.student.findFirst({
          where: {
            stripeCustomerId: invoice.customer.id,
          },
          include: {
            Batch: true,
          },
        })
      }

      // Get the payment record from our database
      const payment = await prisma.studentPayment.findFirst({
        where: {
          stripeInvoiceId: invoiceId,
        },
      })

      return NextResponse.json({
        success: true,
        invoice: {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          amount_due: invoice.amount_due,
          amount_paid: invoice.amount_paid,
          amount_remaining: invoice.amount_remaining,
          currency: invoice.currency,
          created: invoice.created,
          due_date: invoice.due_date,
          paid_at: invoice.status_transitions?.paid_at,
          customer_email: invoice.customer_email,
          customer_name: invoice.customer_name,
          hosted_invoice_url: invoice.hosted_invoice_url,
          invoice_pdf: invoice.invoice_pdf,
          lines: invoice.lines?.data,
          subscription: (invoice as any).subscription,
          charge: (invoice as any).charge,
        },
        student: student ? {
          id: student.id,
          name: student.name,
          email: student.email,
          batchName: student.Batch?.name,
        } : null,
        payment: payment ? {
          id: payment.id,
          paidAt: payment.paidAt,
          amountPaid: payment.amountPaid,
          year: payment.year,
          month: payment.month,
        } : null,
      })
    } catch (stripeError: any) {
      // If invoice not found in Stripe, try to get from database
      const payment = await prisma.studentPayment.findFirst({
        where: {
          OR: [
            { id: invoiceId },
            { stripeInvoiceId: invoiceId },
          ],
        },
        include: {
          Student: {
            include: {
              Batch: true,
            },
          },
        },
      })

      if (!payment) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invoice not found',
          },
          { status: 404 }
        )
      }

      // Return database-only invoice data
      return NextResponse.json({
        success: true,
        invoice: {
          id: payment.stripeInvoiceId || payment.id,
          status: payment.paidAt ? 'paid' : 'unpaid',
          amount_paid: payment.amountPaid,
          paid_at: payment.paidAt,
          created: payment.paidAt,
        },
        student: {
          id: payment.Student.id,
          name: payment.Student.name,
          email: payment.Student.email,
          batchName: payment.Student.Batch?.name,
        },
        payment: {
          id: payment.id,
          paidAt: payment.paidAt,
          amountPaid: payment.amountPaid,
          year: payment.year,
          month: payment.month,
        },
      })
    }
  } catch (error: any) {
    console.error('Error fetching invoice details:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch invoice details',
      },
      { status: 500 }
    )
  }
}