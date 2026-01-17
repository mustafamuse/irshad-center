'use client'

import { cn } from '@/lib/utils'

interface SubTab {
  value: string
  label: string
  count?: number
}

interface SubTabNavigationProps {
  tabs: SubTab[]
  activeTab: string | null
  onTabChange: (tab: string) => void
  className?: string
}

export function SubTabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className,
}: SubTabNavigationProps) {
  const currentTab = activeTab ?? tabs[0]?.value

  return (
    <div
      className={cn('flex gap-6 border-b', className)}
      role="tablist"
      aria-label="Secondary navigation tabs"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={currentTab === tab.value}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            'relative pb-3 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            currentTab === tab.value
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({tab.count})
            </span>
          )}
          {currentTab === tab.value && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
          )}
        </button>
      ))}
    </div>
  )
}
