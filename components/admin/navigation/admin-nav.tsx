'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  DollarSign,
  Calendar,
  ChevronDown,
  Settings,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function AdminNav() {
  const pathname = usePathname()

  const navItems = [
    {
      title: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      title: 'Students',
      icon: Users,
      children: [
        { title: 'MAHAD Students', href: '/admin/students/mahad' },
        { title: 'Dugsi Families', href: '/admin/dugsi' },
        { title: 'Duplicates', href: '/admin/students/duplicates' },
      ],
    },
    {
      title: 'Cohorts',
      href: '/admin/cohorts',
      icon: GraduationCap,
    },
    {
      title: 'Billing',
      icon: DollarSign,
      children: [
        { title: 'Overview', href: '/admin/billing/overview' },
        { title: 'Invoices', href: '/admin/billing/invoices' },
        { title: 'Subscriptions', href: '/admin/billing/subscriptions' },
        { title: 'Profit Share', href: '/admin/billing/profit-share' },
      ],
    },
    {
      title: 'Attendance',
      href: '/admin/attendance',
      icon: Calendar,
    },
  ]

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand */}
          <Link href="/admin" className="flex items-center space-x-2">
            <GraduationCap className="h-6 w-6" />
            <span className="font-bold text-lg">Irshad Admin</span>
          </Link>

          {/* Navigation Items */}
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              if (item.children) {
                // Dropdown menu for items with children
                const isActive = item.children.some(child =>
                  pathname?.startsWith(child.href)
                )

                return (
                  <DropdownMenu key={item.title}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className="gap-1"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.title}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {item.children.map((child, index) => (
                        <div key={child.href}>
                          <Link href={child.href}>
                            <DropdownMenuItem className={cn(
                              "cursor-pointer",
                              pathname === child.href && "bg-accent"
                            )}>
                              {child.title}
                            </DropdownMenuItem>
                          </Link>
                          {index < item.children!.length - 1 && (
                            <DropdownMenuSeparator />
                          )}
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              } else {
                // Regular link for items without children
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname?.startsWith(item.href!)

                return (
                  <Link key={item.title} href={item.href!}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className="gap-2"
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </Button>
                  </Link>
                )
              }
            })}
          </div>

          {/* Settings */}
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  )
}