"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { type PaymentTrendDataPoint } from "@/lib/db/queries/dashboard"

interface ChartAreaInteractiveProps {
  data?: PaymentTrendDataPoint[]
}

const chartConfig = {
  payments: {
    label: "Payments",
  },
  collected: {
    label: "Collected",
    color: "hsl(var(--chart-1))",
  },
  expected: {
    label: "Expected",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({ data }: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("30d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  // Use provided data or empty array
  const chartData = data || []

  const filteredData = chartData.filter((item) => {
    if (chartData.length === 0) return false

    const date = new Date(item.date)
    const today = new Date()
    let daysToSubtract = 90

    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }

    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - daysToSubtract)

    return date >= startDate && date <= today
  })

  // Calculate total collected and expected for the period
  const totals = filteredData.reduce(
    (acc, item) => ({
      collected: acc.collected + item.collected,
      expected: acc.expected + item.expected,
    }),
    { collected: 0, expected: 0 }
  )

  const collectionRate = totals.expected > 0
    ? Math.round((totals.collected / totals.expected) * 100)
    : 0

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Payment Collection Trends</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            {formatCurrency(totals.collected)} collected of {formatCurrency(totals.expected)} expected ({collectionRate}%)
          </span>
          <span className="@[540px]/card:hidden">
            Collection rate: {collectionRate}%
          </span>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="90d" className="h-8 px-2.5">
              Last 3 months
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" className="h-8 px-2.5">
              Last 30 days
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" className="h-8 px-2.5">
              Last 7 days
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="@[767px]/card:hidden flex w-40"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-collected)"
                    stopOpacity={1.0}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-collected)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillExpected" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-expected)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-expected)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${value}`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }}
                    formatter={(value) => formatCurrency(value as number)}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="expected"
                type="natural"
                fill="url(#fillExpected)"
                stroke="var(--color-expected)"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
                fillOpacity={0.3}
              />
              <Area
                dataKey="collected"
                type="natural"
                fill="url(#fillCollected)"
                stroke="var(--color-collected)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No payment data available for the selected time range
          </div>
        )}
      </CardContent>
    </Card>
  )
}