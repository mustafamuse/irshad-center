import { redirect } from 'next/navigation'

export default function AutopayPage() {
  // Redirect to the Mahad page where users can access the payment setup
  // The PaymentBanner at the top has a "Setup Auto-Pay" button that opens the pricing dialog
  redirect('/mahad')
}

export const dynamic = 'force-dynamic'
