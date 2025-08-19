'use client'

import Image from 'next/image'
import Link from 'next/link'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'


import { Button } from '@/components/ui/button'

export default function ComingSoon() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#007078]/5 via-white to-[#deb43e]/5">
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(30deg,#007078_0%,transparent_70%)] opacity-[0.03]" />
        <div className="absolute right-0 top-0 h-[800px] w-[800px] translate-x-1/2 rounded-full bg-gradient-to-l from-[#deb43e]/10 to-transparent" />
      </div>

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          {/* Logo */}
          <div className="mx-auto w-full max-w-lg">
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
            className="space-y-4"
          >
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl lg:text-6xl">
              Coming Soon
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-gray-600 sm:text-xl">
              We're working hard to bring you an enhanced experience. Our new
              website will be launching soon with improved features and better
              accessibility.
            </p>
          </motion.div>

          {/* Program Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
              {/* Irshad Ma'had - Available */}
              <Button
                asChild
                size="lg"
                className="h-auto rounded-2xl bg-[#007078] p-6 text-white shadow-lg transition-all hover:bg-[#007078]/90 hover:shadow-xl"
              >
                <Link
                  href="/mahad"
                  className="flex flex-col items-center gap-3"
                >
                  <div className="text-lg font-semibold">Irshād Māhad</div>
                  <div className="text-sm opacity-90">
                    Islamic Studies Program
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span>Enter Program</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              </Button>

              {/* Irshad Dugsi - Coming Soon */}
              <div className="relative h-auto rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 shadow-sm">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="text-lg font-semibold text-gray-600">
                    Irshād Dugsi
                  </div>
                  <div className="text-sm text-gray-500">
                    Youth Islamic Learning Program
                  </div>
                  <div className="rounded-full bg-gray-200 px-4 py-2 text-xs font-medium text-gray-600">
                    Coming Soon
                  </div>
                </div>

                {/* Overlay to show it's disabled */}
                <div className="absolute inset-0 rounded-2xl bg-white/20" />
              </div>
            </div>

            <p className="text-center text-sm text-gray-500">
              Choose your educational program above
            </p>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="space-y-2 pt-8"
          >
            <p className="text-sm text-gray-500">
              Questions? Contact us at{' '}
              <a
                href="mailto:info@irshadcenter.com"
                className="text-[#007078] hover:underline"
              >
                info@irshadcenter.com
              </a>
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t py-4">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-xs text-gray-400">
            © 2025 Irshād Mâhad. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
