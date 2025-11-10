import { NextRequest, NextResponse } from 'next/server'
import { stripeServerClient as stripe } from '@/lib/stripe'

/**
 * POST /api/admin/invoices/[id]/resend - Resend an invoice email
 */
export async function POST(
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

    console.log(`Resending invoice ${invoiceId}...`)

    // Send the invoice via Stripe
    const invoice = await stripe.invoices.sendInvoice(invoiceId)

    console.log(`Successfully resent invoice ${invoiceId}`)

    return NextResponse.json({
      success: true,
      message: 'Invoice resent successfully',
      invoice: {
        id: invoice.id,
        customer_email: invoice.customer_email,
        status: invoice.status,
      },
    })
  } catch (error: any) {
    console.error('Error resending invoice:', error)

    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      if (error.message.includes('No such invoice')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invoice not found',
          },
          { status: 404 }
        )
      }
      if (error.message.includes('Invoice is not in a sendable state')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invoice cannot be sent in its current state',
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to resend invoice',
      },
      { status: 500 }
    )
  }
}