import { redirect } from 'next/navigation'

export default function AutopayPage() {
  // Redirect to the Mahad page with pricing section
  // The pricing table is embedded in the PaymentBanner component on that page
  redirect('/mahad#pricing')
}

export const dynamic = 'force-dynamic'
