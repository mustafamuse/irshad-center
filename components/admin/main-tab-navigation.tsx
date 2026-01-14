'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Tab {
  value: string
  label: string
  icon?: React.ReactNode
  count?: number
  shortcut?: string
}

interface MainTabNavigationProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tab: string) => void | Promise<unknown>
  className?: string
}

export function MainTabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className,
}: MainTabNavigationProps) {
  return (
    <div
      className={cn(
        'scrollbar-hide flex overflow-x-auto border-b',
        '-mx-4 px-4 sm:mx-0 sm:px-0',
        className
      )}
      role="tablist"
      aria-label="Main navigation tabs"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={activeTab === tab.value}
          aria-controls={`tabpanel-${tab.value}`}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            'group relative flex flex-shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            activeTab === tab.value
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <Badge
              variant="secondary"
              className={cn(
                'ml-1 px-1.5 text-xs',
                activeTab === tab.value && 'bg-primary/10'
              )}
            >
              {tab.count}
            </Badge>
          )}
          <span className="ml-1 hidden text-[10px] text-muted-foreground/50 lg:inline">
            {index + 1}
          </span>
          {activeTab === tab.value && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
          )}
        </button>
      ))}
    </div>
  )
}
