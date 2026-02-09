'use client'

import type { ReactNode } from 'react'

import { LinearGradient } from '@visx/gradient'

export const BRAND_COLORS = {
  teal: '#007078',
  tealLight: '#0ea5a0',
  gold: '#deb43e',
  goldLight: '#f5d06b',
  purple: '#612efb',
  purpleLight: '#9caff6',
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

export function ChartGradients() {
  return (
    <>
      <LinearGradient
        id="grad-teal"
        from={BRAND_COLORS.tealLight}
        to={BRAND_COLORS.teal}
        fromOpacity={0.9}
        toOpacity={1}
      />
      <LinearGradient
        id="grad-gold"
        from={BRAND_COLORS.goldLight}
        to={BRAND_COLORS.gold}
        fromOpacity={0.9}
        toOpacity={1}
      />
      <LinearGradient
        id="grad-area"
        from={BRAND_COLORS.gold}
        to={BRAND_COLORS.gold}
        fromOpacity={0.4}
        toOpacity={0.05}
      />
      <LinearGradient id="grad-bg-teal" from="#0d3d3f" to="#072428" />
      <LinearGradient id="grad-bg-purple" from="#3b1f7e" to="#1a0d3d" />
      <LinearGradient id="grad-bg-warm" from="#3d2b0d" to="#28200a" />
    </>
  )
}

export function TooltipContainer({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur">
      {children}
    </div>
  )
}

export function ChartLegend({
  items,
  light,
}: {
  items: { label: string; color: string }[]
  light?: boolean
}) {
  return (
    <div className="flex items-center justify-center gap-4 pt-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs">
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className={light ? 'text-white/70' : 'text-muted-foreground'}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
