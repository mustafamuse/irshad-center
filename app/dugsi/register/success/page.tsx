import { Suspense } from 'react'

import Link from 'next/link'

import { CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { createServiceLogger } from '@/lib/logger'
import { getCachedDugsiRegistrations } from '@/lib/services/dugsi'
import messages from '@/messages/en.json'

import { SearchableRegistrationsList } from './_components/searchable-registrations-list'
import { groupByFamily } from './_utils/group'

const logger = createServiceLogger('dugsi-success')
const MAX_RECENT_REGISTRATIONS = 50

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Registration Success - Irshād Dugsi',
  description:
    'Your family has been successfully registered for the Dugsi program.',
}

async function RegistrationsList({
  highlightFamilyId,
}: {
  highlightFamilyId?: string
}) {
  let registrations
  try {
    registrations = await getCachedDugsiRegistrations(MAX_RECENT_REGISTRATIONS)
  } catch (error) {
    logger.error({ error }, 'Failed to load registrations')
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-12 text-center">
          <p className="text-red-700">{messages.dugsi.success.errorLoading}</p>
        </CardContent>
      </Card>
    )
  }

  const families = groupByFamily(registrations)

  if (families.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            {messages.dugsi.success.noRegistrations}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <SearchableRegistrationsList
      families={families}
      highlightFamilyId={highlightFamilyId}
    />
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default async function RegistrationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ familyId?: string }>
}) {
  const { familyId } = await searchParams

  return (
    <main className="container mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      {familyId && (
        <Card
          className="border-green-200 bg-green-50"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2
                className="h-6 w-6 text-green-600"
                aria-hidden="true"
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-green-900">
                {messages.dugsi.success.title}
              </h1>
              <p className="text-green-700">
                {messages.dugsi.success.description}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {messages.dugsi.success.recentRegistrations}
        </h2>
        <Button asChild>
          <Link href="/dugsi/register">
            {messages.dugsi.success.registerAnother}
          </Link>
        </Button>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <RegistrationsList highlightFamilyId={familyId} />
      </Suspense>
    </main>
  )
}
