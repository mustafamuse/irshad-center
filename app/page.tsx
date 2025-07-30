'use client'

import * as React from 'react'

import Link from 'next/link'

import { motion } from 'framer-motion'
import { Users2, GraduationCap, CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

import { AnnouncementSection } from './components/announcement-section'
import { ContactSection } from './components/contact-section'
import { ImageCarousel } from './components/image-carousel'
import { MobileNav } from './components/mobile-nav'
import { Pricing } from './components/pricing'
import { Testimonials } from './components/testimonials'

const HomePage: React.FC = () => {
  return (
    <div className="relative flex min-h-screen flex-col">
      <MobileNav />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-8 sm:gap-12 lg:grid-flow-col lg:grid-cols-2 lg:grid-cols-[1fr,1fr]">
              {/* Content */}
              <div className="order-last text-center lg:order-first lg:text-left">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="space-y-6"
                >
                  {/* Main heading */}
                  <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                    Illuminate Your Path
                    <span className="mt-2 block text-[#007078]">
                      Through Sacred Knowledge
                    </span>
                  </h1>

                  {/* Description */}
                  <p className="mx-auto max-w-2xl text-lg text-gray-600 lg:mx-0 lg:text-xl">
                    Where timeless Islamic wisdom meets contemporary learning,
                    nurturing both spiritual growth and academic excellence.
                  </p>

                  {/* Stats */}
                  <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row sm:justify-center lg:justify-start">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#007078]/10">
                        <Users2 className="h-6 w-6 text-[#007078]" />
                      </div>
                      <div className="text-left">
                        <div className="text-2xl font-bold text-gray-900">
                          100+
                        </div>
                        <div className="text-sm text-gray-600">
                          Active Students
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#deb43e]/10">
                        <GraduationCap className="h-6 w-6 text-[#deb43e]" />
                      </div>
                      <div className="text-left">
                        <div className="text-2xl font-bold text-gray-900">
                          Expert
                        </div>
                        <div className="text-sm text-gray-600">
                          Islamic Scholars
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
                    <Button
                      asChild
                      size="lg"
                      className="rounded-full bg-[#007078] px-8 text-white shadow-lg transition-all hover:bg-[#007078]/90 hover:shadow-xl"
                    >
                      <Link href="/register">Begin Your Journey</Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="rounded-full border-[#deb43e] px-8 text-[#deb43e] transition-all hover:bg-[#deb43e]/5"
                    >
                      <Link href="/programs">Explore Programs</Link>
                    </Button>
                  </div>
                </motion.div>
              </div>

              {/* Logo */}
              <motion.div
                className="relative order-first mx-auto flex w-full max-w-md justify-center lg:order-last lg:mx-0 lg:max-w-none lg:justify-end"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.4 }}
              >
                <div className="relative w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[500px]">
                  <Logo size="xl" className="w-full" />
                  <motion.div
                    className="absolute -inset-4 -z-10 bg-gradient-to-r from-[#007078]/10 via-transparent to-[#007078]/10 blur-2xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 1 }}
                  />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Image Carousel */}
          <div className="relative mt-16 w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="w-full"
            >
              <ImageCarousel />
            </motion.div>
          </div>

          {/* Background decorative elements */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-1/2 right-0 h-[1000px] w-[1000px] translate-x-1/2 rounded-full bg-gradient-to-l from-[#007078]/5 to-transparent" />
            <div className="absolute -bottom-1/2 left-0 h-[1000px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#deb43e]/5 to-transparent" />
          </div>
        </section>

        {/* Announcement Section */}
        <AnnouncementSection />

        {/* Programs Section */}
        <section className="bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 sm:p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-2xl font-bold sm:text-3xl">
                    2-Year Irshād Māhad Program
                  </h2>
                  <span className="inline-flex rounded-full bg-[#007078]/10 px-4 py-1.5 text-base font-medium text-[#007078]">
                    Accredited Program
                  </span>
                </div>

                {/* Description */}
                <div className="space-y-4">
                  <p className="text-base leading-relaxed text-gray-600 sm:text-lg">
                    Our flagship program offers a structured curriculum in
                    Islamic Studies, Arabic language, and Quranic Sciences.
                    Accredited under the Islamic University of Minnesota!
                  </p>
                  <a
                    href="site.ium.edu.so"
                    className="inline-block text-[#007078] transition-colors hover:text-[#deb43e]"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Learn more about our accrediting institution at
                    site.ium.edu.so
                  </a>
                </div>

                {/* What's Included */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">What's included</h3>
                  <div className="space-y-6">
                    {[
                      {
                        title: 'Comprehensive Islamic Studies',
                        description:
                          'Foundation in Islamic principles and practices',
                      },
                      {
                        title: 'Arabic Language',
                        description: 'Classical and modern Arabic instruction',
                      },
                      {
                        title: 'Quranic Sciences',
                        description: 'Tajweed and Quranic interpretation',
                      },
                      {
                        title: 'Islamic History',
                        description:
                          'Study of Islamic civilization and heritage',
                      },
                      {
                        title: 'Islamic Jurisprudence',
                        description: 'Understanding of Islamic law and rulings',
                      },
                      {
                        title: 'Character Development',
                        description: 'Focus on Islamic ethics and manners',
                      },
                    ].map((item, index) => (
                      <div key={index} className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#deb43e]/10">
                            <CheckCircle className="h-4 w-4 text-[#deb43e]" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <h4 className="font-medium text-gray-900">
                            {item.title}
                          </h4>
                          <p className="text-gray-600">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 flex flex-col items-center gap-6 border-t pt-6 sm:flex-row sm:justify-between">
                  <div className="text-center sm:text-left">
                    <div className="text-4xl font-bold text-[#007078]">60</div>
                    <div className="text-sm text-gray-600">credit hours</div>
                  </div>
                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <Button
                      asChild
                      size="lg"
                      className="w-full rounded-full bg-[#007078] text-white transition-all hover:bg-[#007078]/90 hover:shadow-lg sm:w-auto"
                    >
                      <Link href="/register" className="px-6">
                        Begin Registration
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="w-full rounded-full border-[#deb43e] text-[#deb43e] transition-all hover:bg-[#deb43e]/10 hover:shadow-lg sm:w-auto"
                    >
                      <Link href="/curriculum" className="px-6">
                        View Curriculum
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Testimonials */}
            <div className="mt-16">
              <Testimonials />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <Pricing />

        {/* Contact Section */}
        <ContactSection />
      </main>

      <footer className="border-t py-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-relaxed text-muted-foreground md:text-left">
            © 2025 Irshād Mâhad. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
export default HomePage
