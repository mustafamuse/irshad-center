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
  description: 'Thank you for paying your Zakat al-Fitr.',
}

export default function ZakatFitrThankYouPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Jazakallahu Khairan!</CardTitle>
          <CardDescription>
            Your Zakat al-Fitr payment has been received. May Allah accept it
            from you and your family.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A confirmation will be sent to your email address.
          </p>
          <Button asChild variant="outline">
            <Link href="/zakat-fitr">Back to Zakat al-Fitr</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
