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

import {
  STATUS_COLORS,
  STATUS_LABELS,
} from '../../../_constants/status-display'

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
