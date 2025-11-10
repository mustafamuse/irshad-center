import { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface CohortsLayoutProps {
  children: ReactNode
}

export default function CohortsLayout({ children }: CohortsLayoutProps) {
  return (
    <div className="flex flex-col space-y-6">
      {/* Cohorts Section Header */}
      <div className="border-b pb-4">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Cohorts</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Cohort Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Organize students into batches and manage class assignments
        </p>
      </div>

      {/* Page Content */}
      <div className="flex-1">{children}</div>
    </div>
  )
}