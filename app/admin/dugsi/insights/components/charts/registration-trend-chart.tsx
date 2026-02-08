'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts'

import type { RegistrationTrendItem } from '@/app/admin/dugsi/_types/insights'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'

const chartConfig = {
  studentCount: {
    label: 'Students',
    color: '#007078',
  },
  familyCount: {
    label: 'Families',
    color: '#deb43e',
  },
} satisfies ChartConfig

interface RegistrationTrendChartProps {
  data: RegistrationTrendItem[]
}

export function RegistrationTrendChart({ data }: RegistrationTrendChartProps) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
      <ComposedChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="studentCount"
          fill="var(--color-studentCount)"
          radius={[4, 4, 0, 0]}
        />
        <Line
          dataKey="familyCount"
          type="monotone"
          stroke="var(--color-familyCount)"
          strokeWidth={2}
          dot={{ fill: 'var(--color-familyCount)' }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
