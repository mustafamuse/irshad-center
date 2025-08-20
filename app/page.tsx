'use client'

import Image from 'next/image'
import Link from 'next/link'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

import PrayerTimes from '@/components/prayer-times'
import { Button } from '@/components/ui/button'

function ComingSoonContent() {
  return (
    <div className="relative min-h-screen bg-white">
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(30deg,#007078_0%,transparent_70%)] opacity-[0.03]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8 sm:space-y-12"
        >
          {/* Header Section */}
          <div className="relative">
            {/* Logo */}
            <div className="mx-auto w-full max-w-[280px] sm:max-w-md">
              <Image
                src="/images/Latest Irshad.png"
                alt="Irshād Mâhad"
                width={500}
                height={300}
                className="h-auto w-full"
                priority
              />
            </div>

            {/* Coming Soon Message */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-6 space-y-4 px-4 text-center sm:mt-8 sm:space-y-6"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#007078]/10 px-4 py-2 text-sm font-medium text-[#007078]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#007078] opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#007078]"></span>
                  </span>
                  Website Update in Progress
                </div>
                <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl md:text-5xl lg:text-6xl">
                  Coming Soon
                </h1>
                <p className="mx-auto max-w-2xl px-2 text-base text-gray-600 sm:text-lg md:text-xl">
                  We're working hard to bring you an enhanced experience. Our
                  new website will be launching soon with improved features and
                  better accessibility.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Program Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            <h2 className="mb-4 text-center text-xl font-semibold text-gray-700">
              Explore Our Educational Programs
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
              {/* Irshad Ma'had - Available */}
              <div className="group relative">
                <Button
                  asChild
                  size="lg"
                  className="h-auto w-full rounded-2xl bg-[#007078] p-4 text-white shadow-lg transition-all duration-300 group-hover:scale-[1.02] group-hover:bg-[#007078]/90 group-hover:shadow-xl sm:p-6"
                >
                  <Link
                    href="/mahad"
                    className="flex flex-col items-center gap-2 sm:gap-3"
                  >
                    <div className="text-xl font-semibold sm:text-2xl">
                      Irshād Māhad
                    </div>
                    <div className="text-sm opacity-90 sm:text-base">
                      Islamic Studies Program
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
                      <span>Visit Now</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1 sm:h-4 sm:w-4" />
                    </div>
                  </Link>
                </Button>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[#007078]/10 bg-white px-2 py-0.5 text-[10px] text-[#007078] shadow-sm sm:px-3 sm:py-1 sm:text-xs">
                  Available Now
                </div>
              </div>

              {/* Irshad Dugsi - Coming Soon */}
              <div className="group relative">
                <div className="h-auto w-full rounded-2xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm transition-all duration-300 group-hover:shadow-md sm:p-6">
                  <div className="flex flex-col items-center gap-2 text-center sm:gap-3">
                    <div className="text-xl font-semibold text-gray-600 sm:text-2xl">
                      Irshād Dugsi
                    </div>
                    <div className="text-sm text-gray-500 sm:text-base">
                      Youth Islamic Learning Program
                    </div>
                    <div className="mt-2 rounded-full border border-gray-200 bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-600 sm:px-6 sm:py-2 sm:text-sm">
                      Coming Soon
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-500 shadow-sm sm:px-3 sm:py-1 sm:text-xs">
                  Under Development
                </div>
              </div>
            </div>
          </motion.div>

          {/* Prayer Times */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <PrayerTimes />
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex justify-center pt-6 sm:pt-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#007078]/10 bg-white/50 px-4 py-2 text-xs text-gray-500 shadow-sm backdrop-blur-sm sm:gap-3 sm:px-6 sm:py-3 sm:text-sm">
              Questions? Contact us at{' '}
              <a
                href="mailto:info@irshadcenter.com"
                className="font-medium text-[#007078] hover:underline"
              >
                info@irshadcenter.com
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="relative mt-12 border-t py-3 sm:mt-16 sm:py-4">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-[10px] text-gray-400 sm:text-xs">
            © 2025 Irshād Mâhad. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

// Server Component wrapper
export default function Page() {
  return <ComingSoonContent />
}
