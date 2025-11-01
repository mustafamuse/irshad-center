'use client'

import * as React from 'react'
import { useEffect } from 'react'

import Link from 'next/link'

import { motion } from 'framer-motion'
import { Users2, BookOpen, Heart, Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

const features = [
  {
    icon: Users2,
    title: 'Family-Focused Learning',
    description: 'Register multiple children from the same family with ease',
    color: 'bg-[#007078]/10',
    textColor: 'text-[#007078]',
  },
  {
    icon: BookOpen,
    title: 'Comprehensive Curriculum',
    description: 'Age-appropriate Islamic education for ages 5 to teens',
    color: 'bg-[#deb43e]/10',
    textColor: 'text-[#deb43e]',
  },
  {
    icon: Heart,
    title: 'Caring Environment',
    description: 'Nurturing atmosphere for your children to learn and grow',
    color: 'bg-[#007078]/10',
    textColor: 'text-[#007078]',
  },
  {
    icon: Shield,
    title: 'Safe & Secure',
    description:
      'Secure registration and payment processing for your peace of mind',
    color: 'bg-[#deb43e]/10',
    textColor: 'text-[#deb43e]',
  },
]

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },
}

const floatingVariants = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

const pulseVariants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

export default function DugsiHomePage() {
  useEffect(() => {
    // Handle scroll to sections if URL has hash
    const cleanup = handleHashScroll(80)
    return cleanup
  }, [])

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-white">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-[linear-gradient(30deg,#007078_0%,transparent_70%)] opacity-[0.07]"
              animate={{
                backgroundPosition: ['0% 0%', '100% 100%'],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
            />
            {/* Floating decorative circles */}
            <motion.div
              className="absolute right-0 top-0 h-[1000px] w-[1000px] translate-x-1/2 rounded-full bg-gradient-to-l from-[#deb43e]/5 to-transparent"
              variants={pulseVariants}
              animate="animate"
            />
            <motion.div
              className="absolute left-0 top-1/4 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#007078]/5 to-transparent blur-3xl"
              variants={pulseVariants}
              animate="animate"
              style={{ transitionDelay: '1s' }}
            />
            <motion.div
              className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-t from-[#deb43e]/5 to-transparent blur-2xl"
              variants={floatingVariants}
              animate="animate"
            />
          </div>

          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center justify-center gap-12"
            >
              {/* Logo */}
              <motion.div
                variants={itemVariants}
                className="relative w-full max-w-xl"
              >
                <motion.div variants={floatingVariants} animate="animate">
                  <Logo size="xl" className="w-full" />
                </motion.div>
                <motion.div
                  className="absolute -inset-4 -z-10 bg-gradient-to-r from-[#007078]/10 via-transparent to-[#007078]/10 blur-2xl"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [0.8, 1, 0.8],
                  }}
                  transition={{
                    delay: 0.4,
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </motion.div>

              {/* Title Section */}
              <motion.div
                variants={itemVariants}
                className="space-y-4 text-center sm:space-y-6"
              >
                {/* Greeting */}
                <motion.p
                  className="text-base font-medium text-[#007078] sm:text-lg md:text-xl"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={{
                    delay: 0.3,
                    duration: 0.6,
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  As-salāmu ʿalaykum wa raḥmatullāh
                </motion.p>

                {/* Subtitle */}
                <motion.p
                  className="text-base text-gray-600 sm:text-lg md:text-xl"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  Islamic Education for Ages 5 to Teens
                </motion.p>

                {/* Description */}
                <motion.p
                  className="mx-auto max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base md:text-lg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                >
                  Welcome to the Irshād Islamic Center Dugsi, a program
                  dedicated to nurturing students in Qur'an, Islamic knowledge,
                  and good manners (adab).
                </motion.p>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                variants={itemVariants}
                className="mt-6 flex w-full flex-col gap-4 sm:mt-8 sm:w-auto sm:flex-row"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  className="w-full sm:w-auto"
                >
                  <Button
                    asChild
                    size="lg"
                    className="w-full rounded-full bg-[#007078] px-8 text-white shadow-lg transition-all hover:bg-[#007078]/90 hover:shadow-xl sm:w-auto"
                  >
                    <Link href="/dugsi/register">Register Your Child</Link>
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  className="w-full sm:w-auto"
                >
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full rounded-full border-[#deb43e] px-8 text-[#deb43e] transition-all hover:bg-[#deb43e]/5 sm:w-auto"
                  >
                    <Link href="#features">Learn More</Link>
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.8 }}
              className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
            >
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: index * 0.1,
                    duration: 0.6,
                  }}
                  whileHover={{
                    y: -8,
                    transition: { duration: 0.3 },
                  }}
                  className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-[#007078]/20 hover:shadow-xl"
                >
                  <motion.div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color} transition-transform duration-300 group-hover:scale-110`}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <feature.icon
                      className={`h-6 w-6 ${feature.textColor}`}
                      aria-hidden="true"
                    />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-[#007078]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {feature.description}
                  </p>
                  {/* Decorative gradient on hover */}
                  <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-[#007078]/0 via-transparent to-[#deb43e]/0 transition-all duration-300 group-hover:from-[#007078]/5 group-hover:to-[#deb43e]/5" />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="relative overflow-hidden bg-gradient-to-r from-[#007078] to-[#005a60] py-16 lg:py-20">
          {/* Animated background pattern */}
          <motion.div
            className="absolute inset-0 opacity-10"
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%'],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
            style={{
              backgroundImage:
                'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '50px 50px',
            }}
          />
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center"
            >
              <motion.h2
                className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                Ready to Get Started?
              </motion.h2>
              <motion.p
                className="mt-4 text-lg text-white/90"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                Register your children today and join our growing community of
                learners
              </motion.p>
              <motion.div
                className="mt-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-white px-8 text-[#007078] shadow-lg transition-all hover:bg-gray-100 hover:shadow-xl"
                  >
                    <Link href="/dugsi/register">Register Now</Link>
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 md:h-24 md:flex-row">
          <motion.p
            className="text-center text-sm leading-relaxed text-muted-foreground md:text-left"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            © 2025 Irshād Center. All rights reserved.
          </motion.p>
          <motion.div
            className="flex items-center gap-6"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Link
              href="/mahad"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              Mahad Program
            </Link>
          </motion.div>
        </div>
      </footer>
    </div>
  )
}

// Helper function for hash scrolling
function handleHashScroll(offset: number) {
  const handleHashChange = () => {
    if (window.location.hash) {
      const element = document.querySelector(window.location.hash)
      if (element) {
        const elementPosition = element.getBoundingClientRect().top
        const offsetPosition = elementPosition + window.pageYOffset - offset

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        })
      }
    }
  }

  // Handle hash on mount
  handleHashChange()

  // Handle hash changes
  window.addEventListener('hashchange', handleHashChange)

  return () => {
    window.removeEventListener('hashchange', handleHashChange)
  }
}
