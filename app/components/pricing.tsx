'use client'

import Link from 'next/link'

import { motion } from 'framer-motion'
import { Check, Sparkles, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function Pricing() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <motion.h2
            className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            New Reduced Tuition
          </motion.h2>
          <motion.p
            className="mt-4 text-lg leading-8 text-gray-600"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Quality Islamic education at an affordable rate
          </motion.p>
        </div>

        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <Card className="overflow-hidden rounded-2xl border-0 bg-white p-8 shadow-sm ring-1 ring-gray-200">
            {/* Savings Badge */}
            <div className="mb-8 flex items-center justify-center">
              <div className="rounded-full bg-[#deb43e]/10 px-4 py-2 text-sm font-medium text-[#deb43e]">
                Save up to $40/month from previous rate
              </div>
            </div>

            {/* Payment Options */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Monthly Option */}
              <div className="rounded-xl bg-white p-6 ring-1 ring-gray-200">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-[#007078]/10 p-2">
                    <Clock className="h-5 w-5 text-[#007078]" />
                  </div>
                  <div className="font-medium">Monthly Payment</div>
                </div>
                <div className="mt-4 flex items-baseline gap-x-2">
                  <span className="text-4xl font-bold tracking-tight text-[#007078]">
                    $120
                  </span>
                  <span className="text-sm text-gray-600">/month</span>
                </div>
                <div className="mt-1 text-sm text-gray-600">Was $150/month</div>
              </div>

              {/* Multi-month Option */}
              <div className="rounded-xl bg-[#007078] p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-white/10 p-2">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="font-medium">2+ Months</div>
                </div>
                <div className="mt-4 flex items-baseline gap-x-2">
                  <span className="text-4xl font-bold tracking-tight">
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
            <div className="mt-10 space-y-4">
              <h3 className="text-lg font-medium">What's Included</h3>
              <ul className="space-y-3">
                {[
                  'Comprehensive Islamic education',
                  'University accredited program',
                  'Expert instructors',
                  'Learning materials included',
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-[#007078]/10 p-1">
                      <Check className="h-4 w-4 text-[#007078]" />
                    </div>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="mt-10">
              <Button
                asChild
                className="w-full rounded-full bg-[#007078] text-white transition-colors hover:bg-[#007078]/90"
              >
                <Link href="/register">Begin Registration</Link>
              </Button>
              <p className="mt-3 text-center text-sm text-gray-600">
                Registration required before setting up monthly payments
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
