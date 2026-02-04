import Link from 'next/link'

import { CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function RegistrationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  const { name } = await searchParams

  return (
    <div className="min-h-screen bg-white px-4 pb-20 pt-4 md:px-6 md:py-8">
      <div className="mx-auto max-w-lg space-y-6 pt-12">
        <Card className="overflow-hidden rounded-2xl border-0 bg-white p-6 shadow-sm ring-1 ring-gray-200 md:p-8">
          <CardHeader className="items-center space-y-4 px-0 pb-4">
            <CheckCircle className="h-12 w-12 text-teal-600" />
            <CardTitle className="text-center text-2xl font-semibold text-[#007078]">
              Registration Complete
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
              <Button
                asChild
                className="w-full bg-[#007078] hover:bg-[#005a60]"
              >
                <Link href="/mahad/register">Register Another Student</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/mahad">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
