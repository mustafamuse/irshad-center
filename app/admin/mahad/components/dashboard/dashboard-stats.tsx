'use client'

import { AlertCircle, AlertTriangle, CheckCircle2, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { DashboardStats as Stats } from '../../_types'

interface DashboardStatsProps {
  stats: Stats
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Enrolled</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.enrolled}</div>
          <p className="text-xs text-muted-foreground">
            {stats.total} total across all batches
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Healthy</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {stats.healthy}
          </div>
          <p className="text-xs text-muted-foreground">Active subscriptions</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">At Risk</CardTitle>
          <AlertTriangle
            className={`h-4 w-4 ${stats.atRisk > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}
          />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${stats.atRisk > 0 ? 'text-amber-600' : ''}`}
          >
            {stats.atRisk}
          </div>
          <p className="text-xs text-muted-foreground">Past due payments</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Needs Action</CardTitle>
          <AlertCircle
            className={`h-4 w-4 ${stats.needsAction > 0 ? 'text-red-500' : 'text-muted-foreground'}`}
          />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${stats.needsAction > 0 ? 'text-red-600' : ''}`}
          >
            {stats.needsAction}
          </div>
          <p className="text-xs text-muted-foreground">
            Canceled or no subscription
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
