'use client'

import * as React from 'react'

import { motion } from 'framer-motion'
import {
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  GraduationCap,
  Calendar,
} from 'lucide-react'

const FacebookIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5 text-[#007078] transition-colors group-hover:text-white"
  >
    <path
      fill="currentColor"
      d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
    />
  </svg>
)

const InstagramIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5 text-[#007078] transition-colors group-hover:text-white"
  >
    <path
      fill="currentColor"
      d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"
    />
  </svg>
)

const TwitterIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5 text-[#007078] transition-colors group-hover:text-white"
  >
    <path
      fill="currentColor"
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    />
  </svg>
)

const studyHours = [
  { day: 'Friday', hours: '6:00 PM - 8:00 PM' },
  { day: 'Saturday', hours: '6:00 PM - 8:00 PM' },
  { day: 'Sunday', hours: '6:00 PM - 8:00 PM' },
]

const contactInfo = {
  address: '6520 Edenvale Blvd # 110, Eden Prairie, MN 55346',
  email: 'umpp101@gmail.com',
  phone: '612-517-7466',
  whatsapp: '6125177466',
}

const socialLinks = [
  { name: 'Facebook', Icon: FacebookIcon },
  { name: 'Instagram', Icon: InstagramIcon },
  { name: 'Twitter', Icon: TwitterIcon },
]

const GridPattern = () => (
  <svg
    className="absolute inset-0 h-full w-full"
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
    fill="none"
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
          d="M.5 40V.5H40"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.1"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid-pattern)" />
  </svg>
)

const MAP_LOCATION = {
  address: '6520 Edenvale Blvd # 110, Eden Prairie, MN 55346',
  googleMapsUrl:
    'https://www.google.com/maps/place/6520+Edenvale+Blvd+%23110,+Eden+Prairie,+MN+55346',
}

export function ContactSection() {
  return (
    <section className="relative overflow-hidden bg-white py-16 sm:py-24">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Get in Touch
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Have questions about our programs? We're here to help you on
                your journey to Islamic education.
              </p>
            </div>

            {/* Contact Details */}
            <div className="space-y-6">
              {/* Address */}
              <motion.div
                className="flex items-start gap-4"
                whileHover={{ x: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#007078]/10">
                  <MapPin className="h-5 w-5 text-[#007078]" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Our Location</h3>
                  <p className="mt-1 text-gray-600">{contactInfo.address}</p>
                </div>
              </motion.div>

              {/* Email */}
              <motion.a
                href={`mailto:${contactInfo.email}`}
                className="flex items-start gap-4"
                whileHover={{ x: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#007078]/10">
                  <Mail className="h-5 w-5 text-[#007078]" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Email Us</h3>
                  <p className="mt-1 text-gray-600">{contactInfo.email}</p>
                </div>
              </motion.a>

              {/* Phone */}
              <motion.a
                href={`tel:${contactInfo.phone}`}
                className="flex items-start gap-4"
                whileHover={{ x: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#007078]/10">
                  <Phone className="h-5 w-5 text-[#007078]" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Call Us</h3>
                  <div className="mt-1 space-y-1">
                    <p className="text-gray-600">{contactInfo.phone}</p>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
                      <span>Available on WhatsApp</span>
                    </div>
                  </div>
                </div>
              </motion.a>

              {/* Study Hours */}
              <motion.div
                className="flex items-start gap-4"
                whileHover={{ x: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#007078]/10">
                  <GraduationCap className="h-5 w-5 text-[#007078]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    Class Schedule
                  </h3>
                  <p className="mt-2.5 text-sm text-gray-600">
                    Classes are held twice a week (2 days) during the following
                    time slots:
                  </p>

                  <div className="mt-4 overflow-hidden rounded-xl bg-[#007078]/5">
                    {studyHours.map(({ day, hours }, index) => (
                      <div
                        key={day}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          index !== studyHours.length - 1
                            ? 'border-b border-[#007078]/10'
                            : ''
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
                          <Calendar className="h-4 w-4 text-[#007078]" />
                        </div>
                        <div className="flex flex-1 items-center justify-between">
                          <span className="font-medium text-[#007078]">
                            {day}
                          </span>
                          <span className="text-sm text-gray-600">{hours}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#deb43e]/10 px-4 py-3">
                    <div className="shrink-0 rounded-full bg-[#deb43e]/20 p-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#deb43e]" />
                    </div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Note:</span> Your specific
                      class days will be assigned from these available time
                      slots.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Social Links */}
            <div>
              <h3 className="font-medium text-gray-900">Follow Us</h3>
              <div className="mt-4 flex gap-4">
                {socialLinks.map(({ name, Icon }) => (
                  <div
                    key={name}
                    className="group relative flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full bg-[#007078]/10 opacity-70 transition-all hover:bg-[#007078]/5"
                    title="Coming soon"
                  >
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 transform">
                      <div className="flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white">
                          Coming Soon
                          {/* Arrow */}
                          <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45 transform bg-gray-900" />
                        </div>
                      </div>
                    </div>

                    <span className="sr-only">{name}</span>
                    <Icon />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Map */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative h-[400px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#007078]/5 to-[#007078]/10 sm:h-[600px]"
          >
            {/* Background Pattern */}
            <GridPattern />

            {/* Map Content */}
            <a
              href={MAP_LOCATION.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex h-full w-full flex-col items-center justify-center p-6 text-center"
            >
              {/* Location Icon */}
              <div className="relative">
                <div className="absolute -inset-4 animate-ping rounded-full bg-[#007078]/20" />
                <div className="relative rounded-full bg-[#007078]/10 p-4">
                  <MapPin className="h-8 w-8 text-[#007078]" />
                </div>
              </div>

              {/* Address */}
              <div className="mt-6 max-w-sm space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Our Location
                </h3>
                <p className="text-gray-600">{MAP_LOCATION.address}</p>
              </div>

              {/* Action Button */}
              <motion.div
                className="mt-8 flex items-center gap-2 rounded-full bg-[#007078] px-6 py-3 text-sm font-medium text-white transition-colors group-hover:bg-[#007078]/90"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Open in Google Maps
                <ExternalLink className="h-4 w-4" />
              </motion.div>

              {/* Decorative Elements */}
              <div className="absolute left-0 top-0 h-32 w-32 bg-gradient-to-br from-[#007078]/20 to-transparent blur-2xl" />
              <div className="absolute bottom-0 right-0 h-32 w-32 bg-gradient-to-tl from-[#deb43e]/20 to-transparent blur-2xl" />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
