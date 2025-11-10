import { TrendingDownIcon, TrendingUpIcon, Users, DollarSign, AlertCircle, Activity } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type DashboardStats } from "@/lib/db/queries/dashboard"

interface SectionCardsProps {
  stats?: DashboardStats
}

export function SectionCards({ stats }: SectionCardsProps) {
  // Use default values if no stats provided
  const data = stats || {
    totalStudents: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
    needsAttention: 0,
    studentGrowth: 0,
    revenueGrowth: 0
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Format percentage
  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
  }
  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Total Students</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.totalStudents.toLocaleString()}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {data.studentGrowth >= 0 ? (
                <TrendingUpIcon className="size-3" />
              ) : (
                <TrendingDownIcon className="size-3" />
              )}
              {formatPercentage(data.studentGrowth)}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {data.studentGrowth >= 0 ? 'Growing enrollment' : 'Enrollment declined'}
            <Users className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Active students in the system
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Active Subscriptions</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.activeSubscriptions.toLocaleString()}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge
              variant="outline"
              className="flex gap-1 rounded-lg text-xs"
            >
              <Activity className="size-3" />
              {Math.round((data.activeSubscriptions / Math.max(data.totalStudents, 1)) * 100)}%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Subscription health <Activity className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {data.activeSubscriptions} of {data.totalStudents} students
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Monthly Revenue</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {formatCurrency(data.monthlyRevenue)}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {data.revenueGrowth >= 0 ? (
                <TrendingUpIcon className="size-3" />
              ) : (
                <TrendingDownIcon className="size-3" />
              )}
              {formatPercentage(data.revenueGrowth)}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {data.revenueGrowth >= 0 ? 'Revenue growing' : 'Revenue declining'}
            <DollarSign className="size-4" />
          </div>
          <div className="text-muted-foreground">Expected monthly income</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Needs Attention</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.needsAttention}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge
              variant={data.needsAttention > 0 ? "destructive" : "outline"}
              className="flex gap-1 rounded-lg text-xs"
            >
              <AlertCircle className="size-3" />
              {data.needsAttention > 0 ? 'Action required' : 'All clear'}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {data.needsAttention > 0 ? 'Students need follow-up' : 'No issues detected'}
            <AlertCircle className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {data.needsAttention > 0 ? 'Past due or incomplete' : 'All subscriptions healthy'}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
