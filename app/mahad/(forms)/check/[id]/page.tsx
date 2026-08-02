import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { lookupByProfileId } from '@/lib/services/mahad/verification-service'

import { MahadPageHeader } from '../../../_components/mahad-page-header'
import { MahadStatusView } from '../_components/shared/mahad-status-view'

// Status must always be live and PII-bearing HTML must never sit in the
// full-route cache (a withdrawn student would see stale "Payment confirmed").
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Registration Status - Irshād Māhad',
  description: 'View your Irshād Māhad registration status.',
  robots: { index: false, follow: false },
}

export default async function MahadCheckByIdPage({
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
      <MahadPageHeader title="Registration status" />
      <main className="space-y-6">
        <MahadStatusView result={result} context="verifying" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/mahad/check">Look up a different registration</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/mahad">Back to home</Link>
          </Button>
        </div>
      </main>
    </>
  )
}
