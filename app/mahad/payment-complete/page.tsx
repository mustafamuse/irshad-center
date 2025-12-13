import Link from 'next/link'

import { CheckCircle2, XCircle } from 'lucide-react'
import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'

export const metadata: Metadata = {
  title: 'Payment Complete - Irshad Mahad',
  description: 'Your payment setup status for Irshad Mahad.',
}

export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const { payment } = await searchParams
  const isSuccess = payment === 'success'
  const isCanceled = payment === 'canceled'

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            transform: scale(1.1);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        .animate-scale-in {
          animation: scaleIn 0.5s ease-out forwards;
        }
        .animate-bounce-in {
          animation: bounceIn 0.6s ease-out forwards;
        }
        .animate-delay-100 { animation-delay: 0.1s; opacity: 0; }
        .animate-delay-200 { animation-delay: 0.2s; opacity: 0; }
        .animate-delay-300 { animation-delay: 0.3s; opacity: 0; }
        .animate-delay-400 { animation-delay: 0.4s; opacity: 0; }
      `}</style>
      <div className="container mx-auto flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="animate-scale-in mb-8 w-64">
          <Logo />
        </div>

        <div className="w-full max-w-md">
          {isSuccess && (
            <Card className="animate-delay-100 animate-fade-in-up border-green-200 bg-green-50">
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="animate-bounce-in animate-delay-200 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div className="animate-delay-300 animate-fade-in-up space-y-3">
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
                  className="animate-delay-400 mt-4 animate-fade-in-up"
                >
                  <Link href="/mahad">Return to Home</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isCanceled && (
            <Card className="animate-delay-100 animate-fade-in-up border-red-200 bg-red-50">
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="animate-bounce-in animate-delay-200 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <div className="animate-delay-300 animate-fade-in-up space-y-3">
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
                  className="animate-delay-400 mt-4 animate-fade-in-up"
                >
                  <Link href="/mahad">Return to Home</Link>
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
                  <Link href="/mahad">Return to Home</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
