'use client'

import { useState } from 'react'

import { motion } from 'framer-motion'
import { MapPin, Navigation, Copy, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IRSHAD_CENTER } from '@/lib/constants/homepage'

export default function LocationMap() {
  const [copied, setCopied] = useState(false)

  const { address, googleMapsUrl } = IRSHAD_CENTER
  const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`

  const copyAddress = async () => {
    await navigator.clipboard.writeText(fullAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="mx-auto w-full max-w-5xl"
    >
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/30 bg-gradient-to-br from-white/40 via-white/20 to-white/10 shadow-2xl backdrop-blur-md dark:border-gray-700/50 dark:from-gray-800/60 dark:via-gray-800/40 dark:to-gray-800/30">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#007078]/5 via-transparent to-[#deb43e]/5 dark:from-[#007078]/10 dark:to-[#deb43e]/10" />

        <div className="relative z-10 p-6 sm:p-8">
          <div className="mb-6 text-center">
            <div className="mb-2 flex items-center justify-center gap-3">
              <div className="rounded-xl bg-[#007078]/10 p-2 backdrop-blur-sm dark:bg-[#007078]/20">
                <MapPin className="h-5 w-5 text-[#007078] dark:text-[#00a0a8]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Location
              </h3>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="aspect-video overflow-hidden rounded-2xl border border-gray-200/30 bg-gray-100 shadow-lg dark:border-gray-700/50 dark:bg-gray-700">
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Irshad Islamic Center Location"
              />
            </div>

            <div className="flex flex-col justify-center space-y-6">
              <div>
                <p className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                  Address
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {address.street}
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  {address.city}, {address.state} {address.zip}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={copyAddress}
                  variant="outline"
                  className="gap-2 rounded-xl border-[#007078]/20 text-[#007078] hover:bg-[#007078]/5 dark:border-[#007078]/40 dark:text-[#00a0a8] dark:hover:bg-[#007078]/20"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? 'Copied!' : 'Copy Address'}
                </Button>

                <Button
                  asChild
                  className="gap-2 rounded-xl bg-[#007078] text-white hover:bg-[#007078]/90"
                >
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="h-4 w-4" />
                    Get Directions
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
