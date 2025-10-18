import { NextResponse } from 'next/server'

import { stripeServerClient } from '@/lib/stripe'

export async function GET() {
  try {
    // Get all setup intents that require verification
    const setupIntents = await stripeServerClient.setupIntents.list({
      limit: 100,
      expand: ['data.customer'],
    })

    // Filter for ones that need verification
    const pendingVerifications = setupIntents.data.filter(
      (intent) =>
        intent.status === 'requires_action' &&
        intent.payment_method_types.includes('us_bank_account')
    )

    // Format the response
    const formattedVerifications = await Promise.all(
      pendingVerifications.map(async (intent) => {
        const customer = intent.customer as any // Expanded customer object

        return {
          id: intent.id,
          email: customer.email,
          name: customer.name,
          // Student: students.map((s: any) => s.name),
          created: new Date(intent.created * 1000).toISOString(),
          last_setup_error: intent.last_setup_error?.message,
        }
      })
    )

    return NextResponse.json(formattedVerifications)
  } catch (error) {
    console.error('Error fetching pending verifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending verifications' },
      { status: 500 }
    )
  }
}
