'use client'

import type { SubscriptionStatus } from '@prisma/client'
import { Label, Pie, PieChart } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

import {
  STATUS_COLORS,
  STATUS_LABELS,
} from '../../../_constants/status-display'

interface Props {
  data: Record<SubscriptionStatus | 'none', number>
  totalFamilies: number
}

export function FamilyStatusChart({ data, totalFamilies }: Props) {
  const entries = (
    Object.entries(data) as [SubscriptionStatus | 'none', number][]
  ).filter(([, count]) => count > 0)

  if (entries.length === 0) return null

  const chartConfig = Object.fromEntries(
    entries.map(([status]) => [
      status,
      { label: STATUS_LABELS[status], color: STATUS_COLORS[status] },
    ])
  ) satisfies ChartConfig

  const chartData = entries.map(([status, count]) => ({
    status,
    families: count,
    fill: `var(--color-${status})`,
  }))

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[220px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={chartData}
          dataKey="families"
          nameKey="status"
          innerRadius={60}
          strokeWidth={5}
        >
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
                      {totalFamilies.toLocaleString()}
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
        <ChartLegend content={<ChartLegendContent nameKey="status" />} />
      </PieChart>
    </ChartContainer>
  )
}
