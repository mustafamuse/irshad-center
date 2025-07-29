'use client'

import Link from 'next/link'

import { Logo } from '@/components/ui/logo'

const navigation = [
  { name: 'HOME', href: '/' },
  { name: 'ABOUT US', href: '/about' },
  { name: 'EVENTS', href: '/events' },
  { name: 'PROGRAMS', href: '/programs' },
  { name: 'FEATURES', href: '/features' },
  { name: 'CONTACT', href: '/contact' },
  { name: 'DONATE', href: '/donate' },
]

export function GlobalHeader() {
  return (
    <header className="absolute left-0 right-0 top-0 z-50">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8"
        aria-label="Global"
      >
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5">
            <span className="sr-only">Irshād Mâhad</span>
            <Logo size="xs" variant="light" className="h-16 w-auto" />
          </Link>
        </div>
        <div className="hidden lg:flex lg:gap-x-12">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium tracking-wide text-white transition-colors hover:text-[#008080]"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}
