'use client'

import * as React from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Menu,
  Home,
  GraduationCap,
  Info,
  Calendar,
  UserPlus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

const menuItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/programs', label: 'Programs', icon: GraduationCap },
  { href: '/about', label: 'About Us', icon: Info },
  { href: '/schedule', label: 'Class Schedule', icon: Calendar },
]

export function MobileNav() {
  const [isOpen, setIsOpen] = React.useState(false)
  const pathname = usePathname()

  // Close menu when route changes
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  return (
    <div className="lg:hidden">
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative z-50 h-10 w-10 text-[#007078] hover:bg-[#007078]/5"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="sr-only">Toggle menu</span>
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-white px-6 pb-6 shadow-2xl"
            >
              <div className="flex h-full flex-col">
                {/* Logo Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-16"
                >
                  <div className="flex w-full items-center justify-center overflow-hidden py-8">
                    <div className="w-[140%] max-w-[600px]">
                      <Logo size="xl" />
                    </div>
                  </div>
                </motion.div>

                {/* Welcome Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center justify-center"
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#007078] px-4 py-2 text-sm text-white">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#deb43e] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#deb43e]" />
                    </span>
                    Welcome to Irshād Māhad
                  </div>
                </motion.div>

                {/* Navigation Items */}
                <nav className="mt-8 flex-1">
                  <motion.div
                    initial="closed"
                    animate="open"
                    variants={{
                      open: {
                        transition: {
                          staggerChildren: 0.1,
                          delayChildren: 0.2,
                        },
                      },
                      closed: {},
                    }}
                    className="space-y-2"
                  >
                    {menuItems.map((item) => {
                      const Icon = item.icon
                      const isActive = pathname === item.href

                      return (
                        <motion.div
                          key={item.href}
                          variants={{
                            open: {
                              opacity: 1,
                              x: 0,
                              transition: {
                                type: 'spring',
                                stiffness: 300,
                                damping: 24,
                              },
                            },
                            closed: { opacity: 0, x: 50 },
                          }}
                        >
                          <Link
                            href={item.href}
                            className={cn(
                              'flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-[#007078] text-white'
                                : 'text-gray-700 hover:bg-[#007078]/5 hover:text-[#007078]'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {item.label}
                          </Link>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                </nav>

                {/* CTA Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-auto"
                >
                  <Button
                    asChild
                    className="relative w-full overflow-hidden rounded-full bg-[#007078] text-white shadow-lg transition-all hover:shadow-xl"
                  >
                    <Link
                      href="https://forms.gle/t38Jurtqes2pbBsVA"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="relative z-10">Begin Registration</span>
                      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#007078] via-[#007078]/90 to-[#deb43e] opacity-0 transition-opacity hover:opacity-100" />
                    </Link>
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
