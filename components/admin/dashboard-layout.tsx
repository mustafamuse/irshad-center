'use client'

import { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { Breadcrumbs } from './breadcrumbs'
import { MainTabNavigation } from './main-tab-navigation'

interface BreadcrumbItem {
  label: string
  onClick?: () => void
}

interface Tab {
  value: string
  label: string
  icon?: ReactNode
  count?: number
}

interface DashboardLayoutProps {
  breadcrumbs: BreadcrumbItem[]
  tabs: Tab[]
  activeTab: string
  onTabChange: (tab: string) => void
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function DashboardLayout({
  breadcrumbs,
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
  contentClassName,
}: DashboardLayoutProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <Breadcrumbs items={breadcrumbs} />

      <MainTabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />

      <div className={cn('min-h-[500px]', contentClassName)}>{children}</div>
    </div>
  )
}
