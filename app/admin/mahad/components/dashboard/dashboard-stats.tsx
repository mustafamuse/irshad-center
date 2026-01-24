'use client'

import { AlertCircle, AlertTriangle, CheckCircle2, Users } from 'lucide-react'

import { StatsCard } from '@/components/admin'

import { DashboardStats as Stats } from '../../_types'

interface DashboardStatsProps {
  stats: Stats
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Enrolled"
        value={stats.enrolled}
        description={`${stats.total} total across all batches`}
        icon={Users}
      />

      <StatsCard
        title="Healthy"
        value={stats.healthy}
        description="Active subscriptions"
        icon={CheckCircle2}
        iconClassName="bg-green-50 text-green-500"
        valueClassName="text-green-600"
      />

      <StatsCard
        title="At Risk"
        value={stats.atRisk}
        description="Past due payments"
        icon={AlertTriangle}
        iconClassName={
          stats.atRisk > 0
            ? 'bg-amber-50 text-amber-500'
            : 'bg-muted text-muted-foreground'
        }
        valueClassName={stats.atRisk > 0 ? 'text-amber-600' : ''}
      />

      <StatsCard
        title="Needs Action"
        value={stats.needsAction}
        description="Canceled or no subscription"
        icon={AlertCircle}
        iconClassName={
          stats.needsAction > 0
            ? 'bg-red-50 text-red-500'
            : 'bg-muted text-muted-foreground'
        }
        valueClassName={stats.needsAction > 0 ? 'text-red-600' : ''}
      />
    </div>
  )
}
