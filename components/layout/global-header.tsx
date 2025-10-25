'use client'

import { useState } from 'react'

import Link from 'next/link'

import { Menu, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'

interface GlobalHeaderProps {
  variant?: 'public' | 'admin'
  className?: string
}

export function GlobalHeader({
  variant = 'public',
  className,
}: GlobalHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isPublic = variant === 'public'
  const isAdmin = variant === 'admin'

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
    >
      <div className="container flex h-16 items-center justify-between px-4 md:h-20">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Logo
              className="hidden h-12 w-auto sm:block"
              variant={variant === 'public' ? 'dark' : 'light'}
            />
            <Logo
              className="block h-8 w-auto sm:hidden"
              variant={variant === 'public' ? 'dark' : 'light'}
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden gap-8 md:flex">
            {isAdmin && (
              <>
                <Link
                  href="/admin/payments"
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Payments
                </Link>
                <Link
                  href="/admin/attendance"
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Attendance
                </Link>
                <Link
                  href="/admin/profit-share"
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Profit Share
                </Link>
              </>
            )}
            {isPublic && (
              <>
                <Link
                  href="/programs"
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Programs
                </Link>
                <Link
                  href="#pricing"
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Pricing
                </Link>
                <Link
                  href="#contact"
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Contact
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isPublic && (
            <>
              <Button
                asChild
                variant="secondary"
                className="hidden h-10 px-4 md:inline-flex md:h-11"
              >
                <Link href="/mahad">Pay Tuition →</Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="border-t bg-background/95 backdrop-blur md:hidden">
          <nav className="container flex flex-col space-y-3 px-4 py-4">
            {isAdmin ? (
              <>
                <Link
                  href="/admin/payments"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Payments
                </Link>
                <Link
                  href="/admin/attendance"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Attendance
                </Link>
                <Link
                  href="/admin/profit-share"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Profit Share
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/programs"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Programs
                </Link>
                <Link
                  href="#pricing"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link
                  href="#contact"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Contact
                </Link>
                <div className="pt-2">
                  <Button asChild className="w-full">
                    <Link href="/mahad">Pay Tuition →</Link>
                  </Button>
                </div>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
