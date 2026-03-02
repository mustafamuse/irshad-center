import Link from 'next/link'

import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Thank You | Irshad Center',
  description: 'Thank you for your generous donation to Irshad Center.',
}

export default function ThankYouPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Thank You!</CardTitle>
          <CardDescription>
            Your donation to Irshad Center has been received. May Allah reward
            you for your generosity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A confirmation will be sent to your email address.
          </p>
          <Button asChild variant="outline">
            <Link href="/donate">Make Another Donation</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
