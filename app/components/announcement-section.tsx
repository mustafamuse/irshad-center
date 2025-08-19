'use client'

import * as React from 'react'

import Link from 'next/link'

import { motion } from 'framer-motion'
import { MessageCircle, Users2, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface TimelinePhase {
  step: number
  title: string
  date: string
  description: string
}

const Pattern: React.FC = () => (
  <svg
    className="absolute inset-0 h-full w-full opacity-5"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern
        id="hero-pattern"
        x="0"
        y="0"
        width="40"
        height="40"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M0 40L40 0H20L0 20M40 40V20L20 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hero-pattern)" />
  </svg>
)

const pulseAnimation = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

const timelinePhases: TimelinePhase[] = [
  {
    step: 1,
    title: 'Application Period',
    date: 'Aug 17 - Sep 3',
    description: 'Submit your application',
  },
  {
    step: 2,
    title: 'Interview Process',
    date: '2nd weekend of Sep (Sep 13-15)',
    description: 'Students invited for assessment',
  },
  {
    step: 3,
    title: 'Classes Begin',
    date: '3rd weekend of Sep (Sep 19-21)',
    description: 'Start your Māhad journey',
  },
]

export const AnnouncementSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-[#007078] px-4 py-12 text-white sm:px-6 lg:px-8">
      {/* Background Pattern */}
      <div className="pointer-events-none absolute inset-0">
        <Pattern />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <motion.div
          className="overflow-hidden rounded-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <motion.div
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"
              variants={pulseAnimation}
              initial="initial"
              animate="animate"
            >
              <MessageCircle className="h-5 w-5 text-[#deb43e]" />
              <span className="text-sm font-medium uppercase tracking-wide text-[#deb43e]">
                Important Announcement
              </span>
            </motion.div>
          </div>

          {/* Main Content */}
          <div className="mt-6 space-y-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Enrollment Opening Soon!
              </h2>
              <p className="mt-3 text-xl text-white/90">
                Join our 2024-2025 academic year. Limited spots available for
                our Islamic Studies program.
              </p>
            </div>

            {/* Info Badges */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex items-center gap-3 rounded-full bg-[#006068] px-5 py-3">
                <Users2 className="h-5 w-5 text-[#deb43e]" />
                <span className="text-sm font-medium">
                  Applications open: Aug 20th, 2025
                </span>
              </div>
              <motion.div
                className="flex items-center gap-3 rounded-full bg-[#006068] px-5 py-3"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Users2 className="h-5 w-5 text-[#deb43e]" />
                <span className="text-sm font-medium">
                  Limited to 30 students
                </span>
              </motion.div>
            </div>

            {/* Timeline */}
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {timelinePhases.map((phase) => (
                <motion.div
                  key={phase.step}
                  className="relative overflow-hidden rounded-2xl bg-[#006068] p-6"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="relative z-10 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#deb43e] text-lg font-bold text-[#007078]">
                        {phase.step}
                      </div>
                      <h3 className="text-lg font-semibold">{phase.title}</h3>
                    </div>
                    <time className="text-[#deb43e]">{phase.date}</time>
                    <p className="text-white/70">{phase.description}</p>
                  </div>
                  {/* Decorative pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <Pattern />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[#deb43e] px-8 text-[#007078] transition-all hover:bg-[#deb43e]/90 hover:shadow-lg"
              >
                <Link
                  href="https://forms.gle/t38Jurtqes2pbBsVA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  Register for September '25
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white px-8 text-[#007078] transition-all hover:bg-white/90 hover:shadow-lg"
              >
                <Link href="/programs">Learn More</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
