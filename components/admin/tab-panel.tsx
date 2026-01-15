'use client'

import { cn } from '@/lib/utils'

interface TabPanelProps {
  id: string
  tabValue: string
  activeTab: string
  children: React.ReactNode
  className?: string
}

/**
 * TabPanel component for accessible tab navigation
 *
 * Provides proper ARIA attributes and IDs to match MainTabNavigation's aria-controls
 */
export function TabPanel({
  id,
  tabValue,
  activeTab,
  children,
  className,
}: TabPanelProps) {
  if (activeTab !== tabValue) {
    return null
  }

  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={`tab-${tabValue}`}
      className={cn(className)}
    >
      {children}
    </div>
  )
}
