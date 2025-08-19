'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { MobileNav } from '@/app/components/mobile-nav'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

const navigation = [
  { href: '/', label: 'Home' },
  { href: '/programs', label: 'Programs' },
  { href: '/about', label: 'About Us' },
  { href: '/schedule', label: 'Class Schedule' },
]

export function GlobalHeader() {
  const pathname = usePathname()

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-20 border-b bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="relative z-50">
          <Logo size="xs" className="h-12 w-auto" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex lg:items-center lg:gap-8">
          {navigation.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-[#007078]',
                  isActive ? 'text-[#007078]' : 'text-gray-700'
                )}
              >
                {item.label}
              </Link>
            )
          })}

          <Link
            href="https://forms.gle/t38Jurtqes2pbBsVA"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 inline-flex items-center justify-center rounded-full bg-[#007078] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#007078]/90 hover:shadow-md"
          >
            Begin Registration
          </Link>
        </nav>

        {/* Mobile Navigation */}
        <MobileNav />
      </div>
    </header>
  )
}
