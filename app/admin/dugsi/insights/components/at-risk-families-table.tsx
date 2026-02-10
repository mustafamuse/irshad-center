import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import {
  STATUS_LABELS,
  STATUS_TAILWIND_BG,
} from '../../_constants/status-display'
import type { AtRiskData } from '../../_types/insights'
import { formatCentsWhole } from '../../_utils/format'

interface AtRiskFamiliesTableProps {
  data: AtRiskData
}

export function AtRiskFamiliesTable({ data }: AtRiskFamiliesTableProps) {
  if (data.families.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">At-Risk Families</h3>
        <span className="text-sm font-medium text-red-600">
          {formatCentsWhole(data.totalAtRiskAmount)} at risk
        </span>
      </div>
      <Card className="border-0 shadow-md">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Family</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Students</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Days Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.families.map((family) => (
                <TableRow key={family.familyReferenceId}>
                  <TableCell className="font-medium">
                    {family.familyName}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white',
                        STATUS_TAILWIND_BG[family.status]
                      )}
                    >
                      {STATUS_LABELS[family.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {family.studentCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsWhole(family.expectedAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsWhole(family.actualAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {family.daysPastDue !== null ? (
                      <span
                        className={cn(
                          'font-medium',
                          family.daysPastDue > 30
                            ? 'text-red-600'
                            : family.daysPastDue > 7
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                        )}
                      >
                        {family.daysPastDue}d
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
