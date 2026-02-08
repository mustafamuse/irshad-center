'use client'

import { useMemo } from 'react'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

import type { RevenueByTier } from '@/app/admin/dugsi/_types/insights'
import { formatCentsWhole } from '@/app/admin/dugsi/_utils/format'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'

const chartConfig = {
  expected: {
    label: 'Expected',
    color: '#007078',
  },
  actual: {
    label: 'Actual',
    color: '#deb43e',
  },
} satisfies ChartConfig

function formatDollarsWhole(dollars: number): string {
  return formatCentsWhole(dollars * 100)
}

interface RevenueTierBarChartProps {
  data: RevenueByTier[]
}

export function RevenueTierBarChart({ data }: RevenueTierBarChartProps) {
  const chartData = useMemo(
    () =>
      data.map((tier) => ({
        tier: tier.tier,
        expected: tier.expectedRevenue / 100,
        actual: tier.actualRevenue / 100,
      })),
    [data]
  )

  return (
    <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
      <BarChart data={chartData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="tier"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: number) => formatDollarsWhole(value)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatDollarsWhole(value as number)}
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
