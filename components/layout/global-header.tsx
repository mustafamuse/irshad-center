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
      <div className="container flex h-14 items-center justify-between px-4 md:h-16">
        {/* Logo */}
        <div className="flex items-center">
          {/* Show full logo on desktop, logo-only on mobile */}
          <Logo size="sm" className="hidden sm:flex" />
          <Logo size="xs" className="flex sm:hidden" />
        </div>

        {/* Desktop Navigation - Public Only */}
        {isPublic && (
          <nav className="hidden gap-6 md:flex">
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
          </nav>
        )}

        {/* Admin Title - Admin Only */}
        {isAdmin && (
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold text-foreground">
              Admin Dashboard
            </h1>
          </div>
        )}

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle - Always Visible */}
          <ThemeToggle />

          {/* Public Actions */}
          {isPublic && (
            <>
              {/* Desktop CTA Button */}
              <Button
                asChild
                variant="secondary"
                className="hidden h-10 px-4 md:inline-flex md:h-11"
              >
                <Link href="https://buy.stripe.com/fZeg0O7va1gt4da3cc">
                  Pay Tuition →
                </Link>
              </Button>

              {/* Mobile Menu Button */}
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
            </>
          )}
        </div>
      </div>

      {/* Mobile Navigation - Public Only */}
      {isPublic && isMobileMenuOpen && (
        <div className="border-t bg-background/95 backdrop-blur md:hidden">
          <nav className="container flex flex-col space-y-3 px-4 py-4">
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
                <Link href="https://buy.stripe.com/fZeg0O7va1gt4da3cc">
                  Pay Tuition →
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
