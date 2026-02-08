'use client'

import { useMemo } from 'react'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

import type { RevenueByTier } from '@/app/admin/dugsi/_types/insights'
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
          tickFormatter={(value: number) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(value)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) =>
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(value as number)
              }
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
