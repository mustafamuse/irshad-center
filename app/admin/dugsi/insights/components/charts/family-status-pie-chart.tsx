'use client'

import { useMemo } from 'react'

import type { SubscriptionStatus } from '@prisma/client'
import { PieChart, Pie, Cell, Label } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

const STATUS_COLORS: Record<SubscriptionStatus | 'none', string> = {
  active: '#22c55e',
  canceled: '#ef4444',
  past_due: '#f97316',
  incomplete: '#eab308',
  trialing: '#3b82f6',
  unpaid: '#b91c1c',
  paused: '#6b7280',
  incomplete_expired: '#9ca3af',
  none: '#cbd5e1',
}

const STATUS_LABELS: Record<SubscriptionStatus | 'none', string> = {
  active: 'Active',
  canceled: 'Canceled',
  past_due: 'Past Due',
  incomplete: 'Incomplete',
  trialing: 'Trialing',
  unpaid: 'Unpaid',
  paused: 'Paused',
  incomplete_expired: 'Incomplete Expired',
  none: 'None',
}

interface FamilyStatusPieChartProps {
  data: Record<SubscriptionStatus | 'none', number>
}

export function FamilyStatusPieChart({ data }: FamilyStatusPieChartProps) {
  const { chartData, chartConfig, total } = useMemo(() => {
    const entries = (
      Object.entries(data) as [SubscriptionStatus | 'none', number][]
    ).filter(([, count]) => count > 0)

    const items = entries.map(([status, count]) => ({
      status,
      count,
      fill: STATUS_COLORS[status],
    }))

    const config: ChartConfig = Object.fromEntries(
      entries.map(([status]) => [
        status,
        { label: STATUS_LABELS[status], color: STATUS_COLORS[status] },
      ])
    )

    return {
      chartData: items,
      chartConfig: config,
      total: entries.reduce((sum, [, count]) => sum + count, 0),
    }
  }, [data])

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[250px]"
    >
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent nameKey="status" hideLabel />}
        />
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="status"
          innerRadius={60}
          outerRadius={80}
          strokeWidth={2}
        >
          {chartData.map((entry) => (
            <Cell key={entry.status} fill={entry.fill} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-3xl font-bold"
                    >
                      {total}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 24}
                      className="fill-muted-foreground text-sm"
                    >
                      Families
                    </tspan>
                  </text>
                )
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
