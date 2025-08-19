import { redirect } from 'next/navigation'

export default function AutopayPage() {
  redirect('https://buy.stripe.com/fZeg0O7va1gt4da3cc')
}

export const dynamic = 'force-dynamic'
