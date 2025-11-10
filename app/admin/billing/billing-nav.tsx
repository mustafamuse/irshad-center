'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Calculator,
} from 'lucide-react'

export function BillingNav() {
  const pathname = usePathname()

  const navItems = [
    {
      title: 'Overview',
      href: '/admin/billing/overview',
      icon: LayoutDashboard,
      description: 'Payment health and metrics',
    },
    {
      title: 'Invoices',
      href: '/admin/billing/invoices',
      icon: FileText,
      description: 'Track payments and invoices',
    },
    {
      title: 'Subscriptions',
      href: '/admin/billing/subscriptions',
      icon: CreditCard,
      description: 'Manage active subscriptions',
    },
    {
      title: 'Profit Share',
      href: '/admin/billing/profit-share',
      icon: Calculator,
      description: 'Calculate profit distributions',
    },
  ]

  return (
    <nav className="flex space-x-1 border-b">
      {navItems.map((item) => {
        const isActive = pathname?.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors hover:text-foreground',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground'
            )}
            title={item.description}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}