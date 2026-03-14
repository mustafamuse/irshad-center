import Link from 'next/link'
import { redirect } from 'next/navigation'

import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getDonationStripeClient } from '@/lib/stripe-donation'

export const metadata: Metadata = {
  title: 'Thank You | Irshad Center',
  description: 'Thank you for paying your Zakat al-Fitr.',
}

export default async function ZakatFitrThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams

  if (!session_id) {
    redirect('/zakat-fitr')
  }

  const stripe = getDonationStripeClient()
  const session = await stripe.checkout.sessions
    .retrieve(session_id)
    .catch(() => null)

  if (!session || session.payment_status !== 'paid') {
    redirect('/zakat-fitr')
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Jazakallahu Khairan!</CardTitle>
          <CardDescription>
            Your Zakat al-Fitr payment has been received. May Allah accept it
            from you and your family.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild variant="outline">
            <Link href="/zakat-fitr">Back to Zakat al-Fitr</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
