import type { Metadata } from 'next'

import { PaymentCompleteContent } from '@/components/payment/payment-complete-content'

export const metadata: Metadata = {
  title: 'Payment Complete - Irshad Mahad',
  description: 'Your payment setup status for Irshad Mahad.',
  robots: { index: false, follow: false },
}

export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const { payment } = await searchParams

  return <PaymentCompleteContent payment={payment} homeUrl="/mahad" />
}
