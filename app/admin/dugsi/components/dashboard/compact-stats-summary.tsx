import Link from 'next/link'

import { ArrowRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getDugsiInsights } from '@/lib/services/dugsi/insights-service'

import { formatCentsWhole } from '../../_utils/format'

export async function CompactStatsSummary() {
  const data = await getDugsiInsights()

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="flex flex-wrap items-center gap-4 py-3 sm:gap-6">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Families</span>
          <span className="text-sm font-bold">{data.health.totalFamilies}</span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Active</span>
          <span className="text-sm font-bold">
            {data.health.activeStudents}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Revenue</span>
          <span className="text-sm font-bold">
            {formatCentsWhole(data.revenue.monthlyRevenue)}
          </span>
        </div>

        {data.revenue.mismatchCount > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-700"
            >
              {data.revenue.mismatchCount} mismatch
              {data.revenue.mismatchCount !== 1 && 'es'}
            </Badge>
          </>
        )}

        <div className="ml-auto">
          <Link
            href="/admin/dugsi/insights"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            View Insights
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
