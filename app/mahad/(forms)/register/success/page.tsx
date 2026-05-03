import Link from 'next/link'

import { CheckCircle } from 'lucide-react'
import { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { MahadPageHeader } from '../../../_components/mahad-page-header'

export const metadata: Metadata = {
  title: 'Registration Complete - Irshād Māhad',
  description: 'Your Irshād Māhad registration has been submitted.',
  robots: { index: false, follow: false },
}

export default async function RegistrationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  const { name } = await searchParams

  return (
    <>
      <MahadPageHeader title="Registration Complete" />
      <main>
        <Card className="overflow-hidden rounded-2xl border-0 bg-white p-6 shadow-sm ring-1 ring-gray-200 md:p-8">
          <CardHeader className="items-center space-y-4 px-0 pb-4">
            <CheckCircle className="h-12 w-12 text-brand" />
            <CardTitle className="text-center text-2xl font-semibold text-brand">
              You&apos;re all set
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-0 text-center">
            <p className="text-gray-600">
              {name
                ? `Thank you, ${name}! Your registration has been submitted.`
                : 'Your registration has been submitted.'}
            </p>
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium">Next Steps</p>
              <p className="mt-1">
                You will receive a payment link from Ustadh Mustafa shortly.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild variant="brand">
                <Link href="/mahad/register">Register Another Student</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/mahad/check">Check registration later</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/mahad">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
