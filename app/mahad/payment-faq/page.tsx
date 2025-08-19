import Link from 'next/link'

import { ArrowLeft } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'

export default function PaymentFAQPage() {
  return (
    <div className="container relative min-h-screen px-4 py-24">
      <div className="mx-auto max-w-3xl">
        {/* Back Button */}
        <Button
          asChild
          variant="ghost"
          className="mb-8 flex items-center gap-2 hover:bg-transparent hover:text-primary"
        >
          <Link href="/mahad">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        {/* Header */}
        <div className="mb-12 space-y-4">
          <h1 className="text-4xl font-bold tracking-tighter">Payment FAQ</h1>
          <p className="text-lg text-muted-foreground">
            Find answers to common questions about payments, policies, and
            procedures.
          </p>
        </div>

        {/* FAQ Accordion */}
        <Accordion type="single" collapsible className="space-y-4">
          <AccordionItem value="pricing">
            <AccordionTrigger>What are the program costs?</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <p>Our program costs $150 per student per month.</p>
              <p>
                We offer a family discount of $10 off per additional student.
              </p>
              <p>
                There are no additional registration or material fees at this
                time.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payment-method">
            <AccordionTrigger>
              What payment methods do you accept?
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              <p>We currently accept US bank accounts (ACH) only.</p>
              <p>To set up payments, you'll need:</p>
              <ul className="ml-6 list-disc space-y-1">
                <li>US-based checking or savings account</li>
                <li>Account holder's name</li>
                <li>Bank routing number</li>
                <li>Bank account number</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="billing">
            <AccordionTrigger>How does billing work?</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <p>Payments are processed during the first week of each month.</p>
              <p>
                The payment will be automatically deducted from your specified
                bank account.
              </p>
              <p>Payments typically take 3-5 business days to process.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="failed-payments">
            <AccordionTrigger>
              What happens if a payment fails?
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              <p>If a payment fails:</p>
              <ul className="ml-6 list-disc space-y-1">
                <li>You will be notified immediately</li>
                <li>The payment will be retried</li>
                <li>
                  Any associated Stripe fees will be added to the next payment
                </li>
              </ul>
              <p>
                Please ensure sufficient funds are available in your account.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="updates">
            <AccordionTrigger>
              How do I update my payment information?
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              <p>You can update your payment information in two ways:</p>
              <ul className="ml-6 list-disc space-y-1">
                <li>Through our autopay portal</li>
                <li>By contacting administration for assistance</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cancellation">
            <AccordionTrigger>
              What is the cancellation policy?
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              <p>To cancel your enrollment and payments:</p>
              <ul className="ml-6 list-disc space-y-1">
                <li>Contact administration to request cancellation</li>
                <li>Cancellation takes effect for the next billing period</li>
                <li>
                  Refunds are available if requested before the second class of
                  the billing period
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="contact">
            <AccordionTrigger>
              How do I contact support for payment issues?
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              <p>You can reach us:</p>
              <ul className="ml-6 list-disc space-y-1">
                <li>In person during weekend office hours (after classes)</li>
                <li>Via WhatsApp</li>
                <li>Through email at contact@irshadislamiccenter.org</li>
              </ul>
              <p>We typically respond immediately during office hours.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}
