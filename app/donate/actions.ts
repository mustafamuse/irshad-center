'use server'

import { redirect } from 'next/navigation'

import { createDonationCheckoutSession } from '@/lib/services/donation/checkout-service'
import { type ActionResult, withActionError } from '@/lib/utils/action-helpers'
import { DonationCheckoutSchema } from '@/lib/validations/donation'

export async function createDonationAction(formData: {
  amount: number
  mode: 'payment' | 'subscription'
  donorName?: string
  donorEmail?: string
  isAnonymous?: boolean
}): Promise<ActionResult<{ url: string }>> {
  return withActionError(async () => {
    const validated = DonationCheckoutSchema.parse(formData)

    const session = await createDonationCheckoutSession(validated)

    if (!session.url) {
      throw new Error('Failed to create checkout session')
    }

    return { url: session.url }
  }, 'Failed to create donation checkout')
}

export async function redirectToDonationCheckout(formData: {
  amount: number
  mode: 'payment' | 'subscription'
  donorName?: string
  donorEmail?: string
  isAnonymous?: boolean
}): Promise<void> {
  const validated = DonationCheckoutSchema.parse(formData)

  const session = await createDonationCheckoutSession(validated)

  if (!session.url) {
    throw new Error('Failed to create checkout session')
  }

  redirect(session.url)
}
