import Image from 'next/image'

import type { Metadata } from 'next'

import { getZakatFitrStats } from '@/lib/db/queries/donation'

import { ZakatFitrForm } from './_components/zakat-fitr-form'
import { ZakatFitrStats } from './_components/zakat-fitr-stats'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Zakat al-Fitr | Irshad Center',
  description:
    'Pay your Zakat al-Fitr obligation — $13 per person in your household.',
}

export default async function ZakatFitrPage() {
  const stats = await getZakatFitrStats()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-white px-4 py-8 sm:py-12">
      <Image
        src="/images/irshad-logo-cropped.svg"
        alt="Irshad Center"
        width={200}
        height={200}
        className="mb-4 h-48 w-auto sm:mb-6 sm:h-72"
        priority
      />
      <ZakatFitrForm />
      <ZakatFitrStats
        totalCollectedCents={stats.totalCollectedCents}
        paymentCount={stats.paymentCount}
        totalPeopleCovered={stats.totalPeopleCovered}
      />
    </div>
  )
}
