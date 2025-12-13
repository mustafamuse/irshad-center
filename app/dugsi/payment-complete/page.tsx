import type { Metadata } from 'next'

import { PaymentCompleteContent } from '@/components/payment/payment-complete-content'

export const metadata: Metadata = {
  title: 'Payment Complete - Irshad Dugsi',
  description: 'Your payment setup status for Irshad Dugsi.',
}

export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const { payment } = await searchParams

  return <PaymentCompleteContent payment={payment} homeUrl="/" />
}
