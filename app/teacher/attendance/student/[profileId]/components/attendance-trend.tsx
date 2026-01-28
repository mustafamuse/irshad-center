'use client'

import { Area, AreaChart, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { WeekendTrendPoint } from '@/lib/mappers/teacher-student-mapper'

interface Props {
  data: WeekendTrendPoint[]
}

const chartConfig = {
  rate: {
    label: 'Attendance %',
    color: 'hsl(var(--chart-1))',
  },
}

export function AttendanceTrend({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No attendance data yet
      </p>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="fillRate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-rate)" stopOpacity={0.8} />
            <stop
              offset="95%"
              stopColor="var(--color-rate)"
              stopOpacity={0.1}
            />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="weekLabel"
          tickLine={false}
          axisLine={false}
          fontSize={12}
        />
        <YAxis domain={[0, 100]} hide />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`${value}%`, 'Attendance']}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="rate"
          stroke="var(--color-rate)"
          fill="url(#fillRate)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}
