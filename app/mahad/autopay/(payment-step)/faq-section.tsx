import { Clock, LockKeyhole, CreditCard } from 'lucide-react'

import { ClientFAQAccordion } from './client-faq-accordion'

const faqItems = [
  {
    id: '1',
    icon: Clock,
    title: 'When will this payment be processed?',
    content: 'This payment will be processed in a few days.',
  },
  {
    id: '2',
    icon: LockKeyhole,
    title: 'Is my information secure?',
    content:
      'Yes, all payment information is securely processed by Stripe, a leading payment processor. We never store your bank details.',
  },
  {
    id: '3',
    icon: CreditCard,
    title: 'What if I need to update my payment method?',
    content:
      'You can update your payment method at any time by contacting Mahad Admin.',
  },
]

export function FAQSection() {
  return (
    <div className="mt-16 border-t">
      <div className="mx-auto max-w-[500px] px-4 py-8 md:max-w-none md:px-6 lg:px-8">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
          <ClientFAQAccordion items={faqItems} />
        </div>
      </div>
    </div>
  )
}
