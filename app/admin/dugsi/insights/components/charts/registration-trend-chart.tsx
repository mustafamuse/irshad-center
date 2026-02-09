'use client'

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts'

import type { RegistrationTrendItem } from '@/app/admin/dugsi/_types/insights'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface Props {
  data: RegistrationTrendItem[]
}

const chartConfig = {
  studentCount: {
    label: 'Students',
    color: '#0ea5a0',
  },
  familyCount: {
    label: 'Families',
    color: '#deb43e',
  },
} satisfies ChartConfig

export function VisxRegistrationTrendChart({ data }: Props) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
      <ComposedChart accessibilityLayer data={data}>
        <defs>
          <linearGradient id="fillFamilies" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#deb43e" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#deb43e" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="studentCount"
          fill="var(--color-studentCount)"
          radius={[4, 4, 0, 0]}
          opacity={0.8}
        />
        <Area
          dataKey="familyCount"
          type="monotone"
          fill="url(#fillFamilies)"
          stroke="none"
        />
        <Line
          dataKey="familyCount"
          type="monotone"
          stroke="var(--color-familyCount)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#deb43e', strokeWidth: 2, stroke: '#fff' }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
