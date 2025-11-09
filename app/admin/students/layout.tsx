import { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { StudentsNav } from './students-nav'

interface StudentsLayoutProps {
  children: ReactNode
}

export default function StudentsLayout({ children }: StudentsLayoutProps) {
  return (
    <div className="flex flex-col space-y-6">
      {/* Students Section Header */}
      <div className="border-b pb-4">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Students</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Student Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage student profiles, enrollment, and academic records
        </p>
      </div>

      {/* Sub-navigation */}
      <StudentsNav />

      {/* Page Content */}
      <div className="flex-1">{children}</div>
    </div>
  )
}