'use client'

import { useState } from 'react'

import Link from 'next/link'

import {
  MapPin,
  Phone,
  Mail,
  Instagram,
  Copy,
  Check,
  Navigation,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IRSHAD_CENTER } from '@/lib/constants/homepage'

export default function SiteFooter() {
  const [copied, setCopied] = useState(false)

  const { address, googleMapsUrl, phone, email, social } = IRSHAD_CENTER
  const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may fail in certain contexts
    }
  }

  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`

  return (
    <footer className="mt-8 border-t border-gray-200/20 bg-gray-50 dark:border-gray-700/50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
              <MapPin className="h-5 w-5 text-[#007078] dark:text-[#00a0a8]" />
              Location
            </h3>
            <div className="aspect-video max-w-sm overflow-hidden rounded-xl border border-gray-200/50 shadow-sm dark:border-gray-700/50">
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
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
              Address
            </h3>
            <p className="mb-1 text-gray-900 dark:text-white">
              {address.street}
            </p>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              {address.city}, {address.state} {address.zip}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={copyAddress}
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-lg border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                asChild
                size="sm"
                className="gap-1.5 rounded-lg bg-[#007078] text-white hover:bg-[#006569]"
              >
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="h-4 w-4" />
                  Directions
                </a>
              </Button>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
              Contact
            </h3>
            <div className="space-y-3">
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-2 text-[#007078] transition-colors hover:text-[#006569] dark:text-[#00a0a8] dark:hover:text-[#00b8b8]"
              >
                <Mail className="h-4 w-4" />
                {email}
              </a>
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-2 text-[#007078] transition-colors hover:text-[#006569] dark:text-[#00a0a8] dark:hover:text-[#00b8b8]"
              >
                <Phone className="h-4 w-4" />
                {phone}
              </a>
              {social.instagram && (
                <a
                  href={social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[#007078] transition-colors hover:text-[#006569] dark:text-[#00a0a8] dark:hover:text-[#00b8b8]"
                >
                  <Instagram className="h-4 w-4" />
                  @irshadislamiccenter
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200/50 pt-6 text-center dark:border-gray-700/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()}{' '}
            <span className="text-[#007078] dark:text-[#00a0a8]">
              Irshād Islamic Center
            </span>
            . All rights reserved.
          </p>
          <div className="mt-2 flex justify-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <Link
              href="/mahad"
              className="hover:text-[#007078] dark:hover:text-[#00a0a8]"
            >
              Māhad
            </Link>
            <Link
              href="/dugsi/register"
              className="hover:text-[#007078] dark:hover:text-[#00a0a8]"
            >
              Dugsi
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
