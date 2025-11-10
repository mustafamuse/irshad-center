'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Users,
  GraduationCap,
  UserPlus,
  AlertTriangle,
} from 'lucide-react'

export function StudentsNav() {
  const pathname = usePathname()

  const navItems = [
    {
      title: 'MAHAD Students',
      href: '/admin/students/mahad',
      icon: GraduationCap,
      description: 'Individual student management',
    },
    {
      title: 'Dugsi Families',
      href: '/admin/dugsi', // Keep existing dugsi route
      icon: Users,
      description: 'Family-based registration',
    },
    {
      title: 'Duplicates',
      href: '/admin/students/duplicates',
      icon: AlertTriangle,
      description: 'Resolve duplicate records',
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