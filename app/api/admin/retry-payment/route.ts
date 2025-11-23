import { NextResponse } from 'next/server'

import { createAPILogger } from '@/lib/logger'
import { getMahadStripeClient } from '@/lib/stripe-mahad'

const logger = createAPILogger('/api/admin/retry-payment')

export async function POST(request: Request) {
  try {
    const { subscriptionId } = await request.json()

    const subscription =
      await getMahadStripeClient().subscriptions.retrieve(subscriptionId)
    const invoice = await getMahadStripeClient().invoices.retrieve(
      subscription.latest_invoice as string
    )

    if (invoice.status !== 'paid') {
      // Create a new PaymentIntent for the failed invoice
      const paymentIntent = await getMahadStripeClient().paymentIntents.create({
        amount: invoice.amount_due,
        currency: invoice.currency,
        customer: invoice.customer as string,
        payment_method: subscription.default_payment_method as string,
        off_session: true,
        confirm: true,
        payment_method_types: ['us_bank_account'],
        mandate_data: {
          customer_acceptance: {
            type: 'online',
            online: {
              ip_address:
                request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                '',
              user_agent: request.headers.get('user-agent') || '',
            },
          },
        },
      })

      // Update invoice with payment method
      await getMahadStripeClient().invoices.pay(invoice.id as string, {
        payment_method: subscription.default_payment_method as string,
      })

      return NextResponse.json({ success: true, paymentIntent })
    }

    return NextResponse.json(
      { error: 'Invoice is already paid' },
      { status: 400 }
    )
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error retrying payment'
    )
    return NextResponse.json(
      { error: 'Failed to retry payment' },
      { status: 500 }
    )
  }
}
