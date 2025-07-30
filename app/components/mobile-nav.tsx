'use client'

import * as React from 'react'

import Link from 'next/link'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  X,
  Home,
  GraduationCap,
  Users,
  Info,
  Calendar,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Programs', href: '/programs', icon: GraduationCap },
  { name: 'About Us', href: '/about', icon: Info },
  { name: 'Class Schedule', href: '/#schedule', icon: Calendar },
  {
    name: 'Begin Registration',
    href: '/register',
    icon: Users,
    highlight: true,
  },
]

export function MobileNav() {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 bg-white/80 backdrop-blur-sm">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <Logo size="xs" />
        </Link>

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Open menu</span>
        </Button>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              className="absolute inset-y-0 right-0 w-full max-w-sm bg-white px-6 py-4"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            >
              <div className="flex items-center justify-between">
                <Logo size="xs" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-6 w-6" />
                  <span className="sr-only">Close menu</span>
                </Button>
              </div>

              <ul className="mt-8 space-y-3">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                        item.highlight
                          ? 'bg-[#007078] text-white hover:bg-[#007078]/90'
                          : 'hover:bg-[#007078]/5'
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
