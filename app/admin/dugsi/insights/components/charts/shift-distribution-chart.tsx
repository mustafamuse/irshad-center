'use client'

import { useMemo } from 'react'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

const chartConfig = {
  count: {
    label: 'Students',
  },
} satisfies ChartConfig

interface ShiftDistributionChartProps {
  morning: number
  afternoon: number
}

export function ShiftDistributionChart({
  morning,
  afternoon,
}: ShiftDistributionChartProps) {
  const chartData = useMemo(
    () => [
      { name: 'Morning', count: morning, fill: '#deb43e' },
      { name: 'Afternoon', count: afternoon, fill: '#007078' },
    ],
    [morning, afternoon]
  )

  return (
    <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
      <BarChart data={chartData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
