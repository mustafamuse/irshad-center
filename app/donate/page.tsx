import type { Metadata } from 'next'

import { DonationForm } from './_components/donation-form'

export const metadata: Metadata = {
  title: 'Donate | Irshad Center',
  description: 'Support the Irshad Center with a one-time or monthly donation.',
}

export default function DonatePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <DonationForm />
    </div>
  )
}
