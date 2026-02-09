'use client'

import type { ReactNode } from 'react'

export const BRAND_COLORS = {
  teal: '#007078',
  gold: '#deb43e',
  red: '#ef4444',
  green: '#22c55e',
  gray: '#6b7280',
} as const

export const CHART_MARGINS = {
  top: 20,
  right: 20,
  bottom: 40,
  left: 60,
} as const

export function TooltipContainer({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      {children}
    </div>
  )
}

export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[]
}) {
  return (
    <div className="flex items-center justify-center gap-4 pt-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs">
          <div
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
