'use client'

import { Label, Pie, PieChart } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface Props {
  morning: number
  afternoon: number
}

const chartConfig = {
  students: {
    label: 'Students',
  },
  morning: {
    label: 'Morning',
    color: '#deb43e',
  },
  afternoon: {
    label: 'Afternoon',
    color: '#0ea5a0',
  },
} satisfies ChartConfig

export function ShiftDistributionChart({ morning, afternoon }: Props) {
  const total = morning + afternoon
  const chartData = [
    { shift: 'morning', students: morning, fill: 'var(--color-morning)' },
    { shift: 'afternoon', students: afternoon, fill: 'var(--color-afternoon)' },
  ]

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
          dataKey="students"
          nameKey="shift"
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
                      {total.toLocaleString()}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 24}
                      className="fill-muted-foreground text-sm"
                    >
                      Students
                    </tspan>
                  </text>
                )
              }
            }}
          />
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="shift" />} />
      </PieChart>
    </ChartContainer>
  )
}
