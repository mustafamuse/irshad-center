import Image from 'next/image'

import type { Metadata } from 'next'

import { DonationForm } from './_components/donation-form'

export const metadata: Metadata = {
  title: 'Donate | Irshad Center',
  description: 'Support the Irshad Center with a monthly donation.',
}

export default function DonatePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
      <Image
        src="/images/irshad-logo-cropped.svg"
        alt="Irshad Center"
        width={200}
        height={200}
        className="mb-6 h-48 w-auto sm:h-56"
        priority
      />
      <DonationForm />
    </div>
  )
}
