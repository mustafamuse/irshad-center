import { notFound } from 'next/navigation'

import { Metadata } from 'next'

import { lookupByProfileId } from '@/lib/services/mahad/verification-service'

import { SuccessSummary } from './_components/success-summary'
import { MahadPageHeader } from '../../../../_components/mahad-page-header'

export const metadata: Metadata = {
  title: 'Registration Complete - Irshād Māhad',
  description: 'Your Irshād Māhad registration has been submitted.',
  robots: { index: false, follow: false },
}

export default async function RegistrationSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await lookupByProfileId(id)

  if (!result.found) {
    notFound()
  }

  return (
    <>
      <MahadPageHeader title="Registration Complete" />
      <main>
        <SuccessSummary result={result} />
      </main>
    </>
  )
}
