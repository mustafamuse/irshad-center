'use client'

import Link from 'next/link'

import { motion } from 'framer-motion'
import {
  Users2,
  GraduationCap,
  CheckCircle,
  ArrowRight,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

import { Pricing } from './components/pricing'

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-white px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              {/* Content */}
              <div className="text-left">
                <motion.h1
                  className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl xl:text-7xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <span>Discover the</span> <br className="hidden sm:block" />
                  <span>Beauty of </span>
                  <span className="text-[#007078]">Islamic</span>
                  <br className="hidden sm:block" />
                  <span className="text-[#007078]">Knowledge</span>
                </motion.h1>

                <motion.p
                  className="mt-8 text-lg leading-8 text-gray-600"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  Join our vibrant community where traditional Islamic education
                  meets modern learning approaches.
                </motion.p>

                {/* Stats */}
                <motion.div
                  className="mt-10 flex flex-col gap-6 sm:flex-row sm:gap-12"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#007078]/10 p-2">
                      <Users2 className="h-5 w-5 text-[#007078]" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      100+ Students Enrolled
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#007078]/10 p-2">
                      <GraduationCap className="h-5 w-5 text-[#007078]" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      Islamic University Instructors
                    </span>
                  </div>
                </motion.div>

                {/* CTA Buttons */}
                <motion.div
                  className="mt-12 flex flex-col gap-4 sm:flex-row"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                >
                  <Button
                    asChild
                    size="lg"
                    className="bg-[#007078] text-white transition-colors hover:bg-[#007078]/90"
                  >
                    <Link href="/register">Begin Registration</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    asChild
                    className="border-[#deb43e] text-[#deb43e] transition-colors hover:bg-[#deb43e]/10"
                  >
                    <Link href="/programs">Explore Programs</Link>
                  </Button>
                </motion.div>
              </div>

              {/* Logo */}
              <motion.div
                className="relative flex justify-center lg:justify-end"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.4 }}
              >
                <Logo size="xl" className="w-[500px]" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Announcements Section */}
        <section className="bg-white px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              className="overflow-hidden rounded-3xl bg-[#007078] p-8 sm:p-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/10 p-2">
                  <MessageCircle className="h-5 w-5 text-[#deb43e]" />
                </div>
                <span className="text-sm font-medium uppercase tracking-wide text-[#deb43e]">
                  Important Announcement
                </span>
              </div>

              {/* Main Content */}
              <div className="mt-6 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-start">
                <div className="flex-1">
                  <h3 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Enrollment Opening Soon!
                  </h3>
                  <p className="mt-3 text-xl text-white/90">
                    Join our 2024-2025 academic year. Limited spots available
                    for our Islamic Studies program.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 rounded-full bg-[#006068] px-5 py-2.5">
                      <Users2 className="h-5 w-5 text-[#deb43e]" />
                      <span className="text-sm font-medium text-white">
                        Applications open: April 1st, 2024
                      </span>
                    </div>
                    <div className="flex items-center gap-3 rounded-full bg-[#006068] px-5 py-2.5">
                      <Users2 className="h-5 w-5 text-[#deb43e]" />
                      <span className="text-sm font-medium text-white">
                        Limited to 30 students
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-[#deb43e] px-8 text-[#007078] transition-colors hover:bg-[#deb43e]/90"
                  >
                    <Link
                      href="/register-interest"
                      className="flex items-center gap-2"
                    >
                      Join Waitlist
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-white px-8 text-[#007078] transition-colors hover:bg-white/90"
                  >
                    <Link href="/programs">Learn More</Link>
                  </Button>
                </div>
              </div>

              {/* Timeline */}
              <div className="mt-16 grid gap-6 sm:grid-cols-3">
                {[
                  {
                    step: 1,
                    title: 'Application Period',
                    date: 'April 1 - May 15',
                    description:
                      'Submit your application and required documents',
                  },
                  {
                    step: 2,
                    title: 'Interview Process',
                    date: 'May 20 - June 10',
                    description:
                      'Selected candidates will be invited for interviews',
                  },
                  {
                    step: 3,
                    title: 'Classes Begin',
                    date: 'September 2024',
                    description: 'Start your journey in Islamic education',
                  },
                ].map((phase) => (
                  <div
                    key={phase.step}
                    className="flex flex-col gap-3 rounded-2xl bg-[#006068] p-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#deb43e] text-lg font-bold text-[#007078]">
                        {phase.step}
                      </div>
                      <h4 className="text-lg font-semibold text-white">
                        {phase.title}
                      </h4>
                    </div>
                    <time className="text-[#deb43e]">{phase.date}</time>
                    <p className="text-white/70">{phase.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Programs Section */}
        <section className="bg-white px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <motion.h2
                className="text-3xl font-bold tracking-tight sm:text-4xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                Our Programs
              </motion.h2>
              <motion.p
                className="mt-4 text-lg leading-8 text-gray-600"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Discover our comprehensive Islamic education programs designed
                to nurture knowledge and understanding at every level.
              </motion.p>
            </div>

            <motion.div
              className="mx-auto mt-16 max-w-4xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-semibold">
                        2-Year Irshād Māhad Program
                      </h3>
                      <span className="inline-flex items-center rounded-full bg-[#007078]/10 px-3 py-1 text-sm font-medium text-[#007078]">
                        Accredited Program
                      </span>
                    </div>

                    <p className="mt-4 text-gray-600">
                      Our flagship program offers a structured curriculum in
                      Islamic Studies, Arabic language, and Quranic Sciences.
                      Accredited under the Islamic University of Minnesota!
                    </p>

                    <div className="mt-2">
                      <a
                        href="site.ium.edu.so"
                        className="text-sm text-[#007078] transition-colors hover:text-[#deb43e]"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Learn more about our accrediting institution at
                        site.ium.edu.so
                      </a>
                    </div>

                    <div className="mt-8">
                      <h4 className="font-medium">What's included</h4>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {[
                          {
                            title: 'Comprehensive Islamic Studies',
                            description:
                              'Foundation in Islamic principles and practices',
                          },
                          {
                            title: 'Arabic Language',
                            description:
                              'Classical and modern Arabic instruction',
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
                            description:
                              'Understanding of Islamic law and rulings',
                          },
                          {
                            title: 'Character Development',
                            description: 'Focus on Islamic ethics and manners',
                          },
                        ].map((item, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="mt-1 rounded-full bg-[#deb43e]/10 p-1">
                              <CheckCircle className="h-4 w-4 text-[#deb43e]" />
                            </div>
                            <div>
                              <h5 className="font-medium">{item.title}</h5>
                              <p className="mt-1 text-sm text-gray-600">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-4 lg:items-end">
                    <div className="text-center lg:text-right">
                      <div className="text-5xl font-bold text-[#007078]">
                        60
                      </div>
                      <div className="text-sm text-gray-600">credit hours</div>
                    </div>

                    <Button
                      asChild
                      variant="outline"
                      className="group w-full border-[#007078] text-[#007078] transition-colors hover:bg-[#007078]/10 lg:w-auto"
                    >
                      <Link
                        href="/curriculum"
                        className="flex items-center justify-center gap-2"
                      >
                        View Full Curriculum
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>

                    <p className="text-center text-sm text-gray-600 lg:text-right">
                      Classes held at our Eden Prairie location
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Pricing Section */}
        <Pricing />

        {/* Contact Section - Mobile optimized */}
        <section
          id="contact"
          className="container space-y-8 px-4 py-12 md:space-y-12 md:py-24"
        >
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
            <h2 className="text-2xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">
              Contact Us
            </h2>
            <p className="max-w-[85%] text-base leading-relaxed text-muted-foreground sm:text-lg">
              We're here to help. Get in touch with us.
            </p>
          </div>
          <div className="mx-auto max-w-2xl space-y-6 rounded-xl border bg-card/50 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-2">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <p className="text-base leading-relaxed">
                6520 Edenvale Blvd # 110, Eden Prairie, MN 55346
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-2">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <p className="text-base">umpp101@gmail.com</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-2">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-base">612-517-7466</p>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-base text-green-700">
                  <MessageCircle className="h-5 w-5" />
                  <span>WhatsApp</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-relaxed text-muted-foreground md:text-left">
            © 2024 Irshād Mâhad. All rights reserved.
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
