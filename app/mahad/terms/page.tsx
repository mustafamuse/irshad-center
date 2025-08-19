'use client'

import * as React from 'react'

import Link from 'next/link'

import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

const sections = [
  { id: 'acceptance', title: 'Acceptance of Terms' },
  { id: 'program', title: 'Program Information' },
  { id: 'payment', title: 'Payment Terms' },
  { id: 'cancellation', title: 'Cancellation and Refunds' },
  { id: 'conduct', title: 'Code of Conduct' },
  { id: 'communication', title: 'Communication' },
  { id: 'changes', title: 'Changes to Terms' },
  { id: 'contact', title: 'Contact Us' },
]

// Pattern SVG component for the background
const Pattern = () => (
  <svg
    className="absolute inset-0 h-full w-full opacity-5"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern
        id="grid-pattern"
        x="0"
        y="0"
        width="40"
        height="40"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M0 40L40 0H20L0 20M40 40V20L20 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid-pattern)" />
  </svg>
)

export default function TermsPage() {
  // Format today's date
  const formattedDate = React.useMemo(() => {
    const date = new Date()
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }, [])

  return (
    <div className="relative min-h-screen bg-white">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 right-0 h-[1000px] w-[1000px] translate-x-1/2 rounded-full bg-gradient-to-l from-[#007078]/5 to-transparent" />
        <div className="absolute -bottom-1/2 left-0 h-[1000px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#deb43e]/5 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16">
          <div className="flex items-center justify-between">
            <Button
              asChild
              variant="ghost"
              className="flex items-center gap-2 text-[#007078] transition-colors hover:bg-[#007078]/5"
            >
              <Link href="/mahad">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <Logo size="sm" />
          </div>

          <div className="relative mt-12 text-center">
            <Pattern />
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Terms & Policies
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Last updated: {formattedDate}
            </p>
          </div>
        </div>

        <div className="relative flex gap-8">
          {/* Table of Contents - Desktop */}
          <div className="sticky top-8 hidden h-fit w-64 shrink-0 lg:block">
            <div className="rounded-xl bg-[#007078]/5 p-6">
              <h3 className="font-medium text-gray-900">On this page</h3>
              <nav className="mt-4 space-y-2">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block text-sm text-gray-600 transition-colors hover:text-[#007078]"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="relative flex-1 overflow-hidden rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
            <Pattern />
            <div className="prose prose-gray mx-auto max-w-none">
              <section id="acceptance" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                  Acceptance of Terms
                </h2>
                <p className="mt-4 text-gray-600">
                  By enrolling in our programs or using our services, you agree
                  to these Terms & Policies. Please read them carefully before
                  proceeding with enrollment.
                </p>
              </section>

              <section
                id="program"
                className="mb-12 scroll-mt-8 border-t border-gray-100 pt-8"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                  Program Information
                </h2>
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-xl font-medium text-gray-900">
                      Duration and Structure
                    </h3>
                    <ul className="mt-4 list-none space-y-2 pl-0">
                      {[
                        'Programs are structured as 2-year courses',
                        'Classes are held twice a week (selected from Friday, Saturday, or Sunday)',
                        'Class times are 6:00 PM - 8:00 PM',
                        'Assessment test required before enrollment',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#007078]" />
                          <span className="text-gray-600">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-medium text-gray-900">
                      Eligibility
                    </h3>
                    <p className="mt-2 text-gray-600">
                      While our programs are open to all age groups, they are
                      primarily designed for late high school to college-age
                      students. All prospective students must complete an
                      assessment test before enrollment.
                    </p>
                  </div>
                </div>
              </section>

              <section
                id="payment"
                className="mb-12 scroll-mt-8 border-t border-gray-100 pt-8"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                  Payment Terms
                </h2>
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-xl font-medium text-gray-900">
                      Fees and Billing
                    </h3>
                    <ul className="mt-4 list-none space-y-2 pl-0">
                      {[
                        'Monthly tuition: $120 per student',
                        'Multi-month discount: $110/month when paying for 2+ months',
                        'Payments processed first week of each month',
                        'US bank account (ACH) payments only',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#007078]" />
                          <span className="text-gray-600">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-medium text-gray-900">
                      Payment Policies
                    </h3>
                    <ul className="mt-4 list-none space-y-2 pl-0">
                      {[
                        'Automatic monthly payments required',
                        'Failed payments will be retried with added processing fees',
                        'Banking information updates must be submitted through proper channels',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#007078]" />
                          <span className="text-gray-600">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section
                id="cancellation"
                className="mb-12 scroll-mt-8 border-t border-gray-100 pt-8"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                  Cancellation and Refunds
                </h2>
                <ul className="mt-4 list-none space-y-2 pl-0">
                  {[
                    'Cancellation requests must be submitted to administration',
                    'Cancellations effective from next billing period',
                    'Refunds available if requested before second class of billing period',
                    'No refunds for partial attendance',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#007078]" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section
                id="conduct"
                className="mb-12 scroll-mt-8 border-t border-gray-100 pt-8"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                  Code of Conduct
                </h2>
                <p className="mt-4 text-gray-600">Students are expected to:</p>
                <ul className="mt-4 list-none space-y-2 pl-0">
                  {[
                    'Maintain respectful behavior towards instructors and peers',
                    'Complete assigned coursework',
                    'Participate actively in classes',
                    'Adhere to Islamic principles and values',
                    'Follow classroom and facility rules',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#007078]" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section
                id="communication"
                className="mb-12 scroll-mt-8 border-t border-gray-100 pt-8"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                  Communication
                </h2>
                <ul className="mt-4 list-none space-y-2 pl-0">
                  {[
                    'Primary communication through WhatsApp and email',
                    'Office hours available during weekends after classes',
                    'Emergency contact information must be kept current',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#007078]" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section
                id="changes"
                className="mb-12 scroll-mt-8 border-t border-gray-100 pt-8"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                  Changes to Terms
                </h2>
                <p className="mt-4 text-gray-600">
                  We reserve the right to modify these terms at any time.
                  Changes will be effective immediately upon posting to our
                  website. Continued enrollment constitutes acceptance of any
                  changes.
                </p>
              </section>

              <section
                id="contact"
                className="mb-12 scroll-mt-8 border-t border-gray-100 pt-8"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                  Contact Us
                </h2>
                <p className="mt-4 text-gray-600">
                  For questions about these terms or our policies, please
                  contact us:
                </p>
                <ul className="mt-4 list-none space-y-2 pl-0">
                  {[
                    'Email: umpp101@gmail.com',
                    'In person: During weekend office hours',
                    'WhatsApp: Available during business hours',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#007078]" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
