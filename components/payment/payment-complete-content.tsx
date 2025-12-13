import Link from 'next/link'

import { CheckCircle2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'

interface PaymentCompleteContentProps {
  payment?: string
  homeUrl: string
}

export function PaymentCompleteContent({
  payment,
  homeUrl,
}: PaymentCompleteContentProps) {
  const isSuccess = payment === 'success'
  const isCanceled = payment === 'canceled'

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="container mx-auto flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 w-64 animate-scale-in">
          <Logo />
        </div>

        <div className="w-full max-w-md">
          {isSuccess && (
            <Card className="animate-fade-in-up border-green-200 bg-green-50 [animation-delay:0.1s] [animation-fill-mode:backwards]">
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 animate-bounce-in items-center justify-center rounded-full bg-green-100 [animation-delay:0.2s] [animation-fill-mode:backwards]">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div className="animate-fade-in-up space-y-3 [animation-delay:0.3s] [animation-fill-mode:backwards]">
                  <h1 className="text-2xl font-semibold text-green-800">
                    JazakAllahu Khayran!
                  </h1>
                  <p className="text-green-700">
                    Your autopay is set up. Ustadh Mustafa has been notified.
                    Thank you!
                  </p>
                  <div className="border-t border-green-200 pt-3">
                    <h2 className="text-2xl font-semibold text-green-800">
                      JazakAllahu Khayran!
                    </h2>
                  </div>
                  <p className="text-green-700">
                    Autopay-ga waa la bilaabay. Ustaadh Mustafa waa la
                    ogeysiiyey. Mahadsanid!
                  </p>
                </div>
                <Button
                  asChild
                  className="mt-4 animate-fade-in-up [animation-delay:0.4s] [animation-fill-mode:backwards]"
                >
                  <Link href={homeUrl}>Return to Home</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isCanceled && (
            <Card className="animate-fade-in-up border-red-200 bg-red-50 [animation-delay:0.1s] [animation-fill-mode:backwards]">
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 animate-bounce-in items-center justify-center rounded-full bg-red-100 [animation-delay:0.2s] [animation-fill-mode:backwards]">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <div className="animate-fade-in-up space-y-3 [animation-delay:0.3s] [animation-fill-mode:backwards]">
                  <h1 className="text-2xl font-semibold text-red-800">
                    Payment Setup Failed
                  </h1>
                  <p className="text-red-700">
                    Your autopay could not be set up due to an issue. Please
                    reach out to Ustadh Mustafa so we can assist you. Thank you.
                  </p>
                  <div className="border-t border-red-200 pt-3">
                    <h2 className="text-2xl font-semibold text-red-800">
                      Autopay Ma Shaqeyn
                    </h2>
                  </div>
                  <p className="text-red-700">
                    Autopay-ga weli ma shaqeyn. Fadlan la soo xiriir Ustaadh
                    Mustafa si aan u xallinno arrinta. Mahadsanid.
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="mt-4 animate-fade-in-up [animation-delay:0.4s] [animation-fill-mode:backwards]"
                >
                  <Link href={homeUrl}>Return to Home</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!isSuccess && !isCanceled && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-muted-foreground">
                  No payment status found. If you just completed a payment,
                  please check your email for confirmation.
                </p>
                <Button asChild variant="outline">
                  <Link href={homeUrl}>Return to Home</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
