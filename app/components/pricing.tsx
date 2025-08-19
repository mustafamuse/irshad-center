'use client'

import Link from 'next/link'

import { motion } from 'framer-motion'
import { Check, Sparkles, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function Pricing() {
  return (
    <section className="relative overflow-hidden bg-white px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50/50" />

      <div className="relative mx-auto max-w-3xl">
        <div className="text-center">
          <motion.h2
            className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl md:text-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            New Reduced Tuition
          </motion.h2>
          <motion.p
            className="mt-3 text-base leading-7 text-gray-600 sm:mt-4 sm:text-lg sm:leading-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Quality Islamic education at an affordable rate
          </motion.p>
        </div>

        <motion.div
          className="mt-10 sm:mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <Card className="overflow-hidden rounded-2xl border-0 bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 lg:p-8">
            {/* Savings Badge */}
            <div className="mb-6 flex items-center justify-center sm:mb-8">
              <div className="rounded-full bg-[#deb43e]/10 px-4 py-2 text-sm font-medium text-[#deb43e]">
                Save up to $40/month from previous rate
              </div>
            </div>

            {/* Payment Options */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              {/* Monthly Option */}
              <div className="relative rounded-xl bg-white p-4 ring-1 ring-gray-200 transition-shadow hover:shadow-md sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-[#007078]/10 p-2">
                    <Clock className="h-5 w-5 text-[#007078]" />
                  </div>
                  <div className="font-medium">Monthly Payment</div>
                </div>
                <div className="mt-4 flex items-baseline gap-x-2">
                  <span className="text-3xl font-bold tracking-tight text-[#007078] sm:text-4xl">
                    $120
                  </span>
                  <span className="text-sm text-gray-600">/month</span>
                </div>
                <div className="mt-1 text-sm text-gray-600">Was $150/month</div>
              </div>

              {/* Multi-month Option */}
              <div className="relative rounded-xl bg-[#007078] p-4 text-white transition-shadow hover:shadow-md sm:p-6">
                {/* Popular badge */}
                <div className="absolute -right-1 -top-1 rounded-full bg-[#deb43e] px-3 py-1 text-xs font-medium text-white shadow-sm">
                  Popular
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-white/10 p-2">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="font-medium">2+ Months</div>
                </div>
                <div className="mt-4 flex items-baseline gap-x-2">
                  <span className="text-3xl font-bold tracking-tight sm:text-4xl">
                    $110
                  </span>
                  <span className="text-sm text-white/90">/month</span>
                </div>
                <div className="mt-1 text-sm text-white/80">
                  Additional $10 savings per month
                </div>
              </div>
            </div>

            {/* What's Included */}
            <div className="mt-8 space-y-4 sm:mt-10">
              <h3 className="text-lg font-medium">What's Included</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  'Comprehensive Islamic education',
                  'University accredited program',
                  'Expert instructors',
                  'Learning materials included',
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-lg bg-gray-50/50 p-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="rounded-full bg-[#007078]/10 p-1">
                      <Check className="h-4 w-4 text-[#007078]" />
                    </div>
                    <span className="text-sm text-gray-600 sm:text-base">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 sm:mt-10">
              <Button
                asChild
                size="lg"
                className="w-full rounded-full bg-[#007078] text-base font-medium text-white transition-all hover:bg-[#007078]/90 hover:shadow-lg sm:text-lg"
              >
                <Link
                  href="https://forms.gle/t38Jurtqes2pbBsVA"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Begin Registration
                </Link>
              </Button>
              <p className="mt-3 text-center text-xs text-gray-600 sm:text-sm">
                Registration required before setting up monthly payments
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
