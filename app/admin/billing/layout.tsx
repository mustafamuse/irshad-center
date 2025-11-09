import { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { BillingNav } from './billing-nav'

interface BillingLayoutProps {
  children: ReactNode
}

export default function BillingLayout({ children }: BillingLayoutProps) {
  return (
    <div className="flex flex-col space-y-6">
      {/* Billing Section Header */}
      <div className="border-b pb-4">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Billing</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Billing Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage payments, subscriptions, and financial operations
        </p>
      </div>

      {/* Sub-navigation */}
      <BillingNav />

      {/* Page Content */}
      <div className="flex-1">{children}</div>
    </div>
  )
}