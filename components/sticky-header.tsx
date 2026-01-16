'use client'

import { useState, useEffect } from 'react'

import Image from 'next/image'
import Link from 'next/link'

import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'

export default function StickyHeader() {
  const { theme, setTheme } = useTheme()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!mounted) return null

  return (
    <AnimatePresence>
      {isScrolled && (
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed left-0 right-0 top-0 z-50 border-b border-gray-200/20 bg-white/80 backdrop-blur-lg dark:border-gray-700/50 dark:bg-gray-950/80"
        >
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/images/Mosque-transparent.svg"
                alt="Irshād"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </Link>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5 text-[#deb43e]" />
                ) : (
                  <Moon className="h-5 w-5 text-[#007078]" />
                )}
              </button>

              <Button
                disabled
                size="sm"
                className="cursor-not-allowed gap-1.5 rounded-full bg-[#deb43e]/50 px-4 text-white"
                title="Donations coming soon"
                aria-label="Donate - coming soon"
              >
                <Heart className="h-4 w-4" />
                <span className="hidden sm:inline">Donate</span>
              </Button>
            </div>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  )
}
