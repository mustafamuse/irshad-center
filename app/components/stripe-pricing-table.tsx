'use client'

import { useEffect } from 'react'

export function StripePricingTable() {
  useEffect(() => {
    // Add the script tag to the document head
    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/pricing-table.js'
    script.async = true
    document.head.appendChild(script)

    // Cleanup on unmount
    return () => {
      document.head.removeChild(script)
    }
  }, [])

  // Use the exact HTML structure from Stripe
  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="min-h-[500px]"
          dangerouslySetInnerHTML={{
            __html: `
              <stripe-pricing-table pricing-table-id="prctbl_1RsbgwFsdFzP1bzTQjfHGAjk"
publishable-key="pk_live_51P7pdHFsdFzP1bzTGfRs389jbQejhLD3DxvB1w5Vf4msIMZZtKS4dsZvnaKt63QlSqmVgPcvKffeXAITCZlIVPBU00mAloYMUd">
</stripe-pricing-table>
            `,
          }}
        />
      </div>
    </section>
  )
}
