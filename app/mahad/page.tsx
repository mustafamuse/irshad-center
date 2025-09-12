'use client'

import * as React from 'react'
import { useEffect } from 'react'

import Link from 'next/link'

import { motion } from 'framer-motion'
import { Users2, GraduationCap, BookOpen, Building2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { handleHashScroll } from '@/lib/utils/scroll'

import { AnnouncementSection } from './_components/announcement-section'
import { ContactSection } from './_components/contact-section'
import { ImageCarousel } from './_components/image-carousel'
import { MobileNav } from './_components/mobile-nav'
import { PaymentBanner } from './_components/payment-banner'
import SemesterCountdown from './_components/semester-countdown'
import { Testimonials } from './_components/testimonials'

const features = [
  {
    icon: Users2,
    title: '100+ Active Students',
    description: 'Join our growing community of dedicated learners',
    color: 'bg-[#007078]/10',
    textColor: 'text-[#007078]',
  },
  {
    icon: GraduationCap,
    title: 'Accredited Instructors',
    description: 'Learn from qualified and experienced instructors',
    color: 'bg-[#deb43e]/10',
    textColor: 'text-[#deb43e]',
  },
  {
    icon: BookOpen,
    title: 'Comprehensive Curriculum',
    description: 'Structured learning path for all levels',
    color: 'bg-[#007078]/10',
    textColor: 'text-[#007078]',
  },
  {
    icon: Building2,
    title: 'Traditional & Modern',
    description: 'Bridging classical hikwa with contemporary needs',
    color: 'bg-[#deb43e]/10',
    textColor: 'text-[#deb43e]',
  },
]

const HomePage: React.FC = () => {
  useEffect(() => {
    // Handle scroll to announcement section if URL has #announcements
    const cleanup = handleHashScroll(80) // 80px offset to account for fixed header
    return cleanup
  }, [])
  return (
    <div className="relative flex min-h-screen flex-col">
      <PaymentBanner />
      <MobileNav />
      <SemesterCountdown />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-white">
          {/* Background Pattern */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[linear-gradient(30deg,#007078_0%,transparent_70%)] opacity-[0.07]" />
            <div className="absolute right-0 top-0 h-[1000px] w-[1000px] translate-x-1/2 rounded-full bg-gradient-to-l from-[#deb43e]/5 to-transparent" />
          </div>

          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="flex flex-col items-center justify-center gap-12">
              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="relative w-full max-w-xl"
              >
                <Logo size="xl" className="w-full" />
                <motion.div
                  className="absolute -inset-4 -z-10 bg-gradient-to-r from-[#007078]/10 via-transparent to-[#007078]/10 blur-2xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 1 }}
                />
              </motion.div>

              {/* Carousel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="w-full max-w-4xl"
              >
                <ImageCarousel />
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="flex flex-col gap-4 sm:flex-row"
              >
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-[#007078] px-8 text-white shadow-lg transition-all hover:bg-[#007078]/90 hover:shadow-xl"
                >
                  <Link
                    href="https://forms.gle/t38Jurtqes2pbBsVA"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Begin Registration
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-[#deb43e] px-8 text-[#deb43e] transition-all hover:bg-[#deb43e]/5"
                >
                  <Link href="/mahad/programs">View All Courses</Link>
                </Button>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
            >
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md"
                >
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}
                  >
                    <feature.icon
                      className={`h-6 w-6 ${feature.textColor}`}
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Rest of the sections */}
        <AnnouncementSection />
        <Testimonials />
        <ContactSection />
      </main>

      <footer className="border-t py-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-relaxed text-muted-foreground md:text-left">
            © 2025 Irshād Mâhad. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/mahad/terms"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Terms
            </Link>
            <Link
              href="/mahad/privacy"
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
