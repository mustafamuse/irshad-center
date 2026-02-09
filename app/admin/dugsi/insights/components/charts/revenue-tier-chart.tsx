'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import type { RevenueByTier } from '@/app/admin/dugsi/_types/insights'
import { formatCentsWhole } from '@/app/admin/dugsi/_utils/format'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface Props {
  data: RevenueByTier[]
}

const chartConfig = {
  expected: {
    label: 'Expected',
    color: '#0ea5a0',
  },
  actual: {
    label: 'Actual',
    color: '#deb43e',
  },
} satisfies ChartConfig

export function VisxRevenueTierChart({ data }: Props) {
  const chartData = data.map((d) => ({
    tier: d.tier,
    expected: d.expectedRevenue,
    actual: d.actualRevenue,
  }))

  return (
    <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="tier"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCentsWhole(v as number)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {chartConfig[name as keyof typeof chartConfig]?.label}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatCentsWhole(value as number)}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="expected"
          fill="var(--color-expected)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="actual"
          fill="var(--color-actual)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}
