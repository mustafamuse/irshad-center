'use client'

import { Users, DollarSign, GraduationCap, Link2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatsCardsClientProps {
  totalOrphaned: number
  uniqueMultiSubCustomers: number
  totalRevenue: number
  mahadCount: number
  dugsiCount: number
  onFilterClick?: (filter: {
    type: 'program' | 'status' | 'amount'
    value: string
  }) => void
}

export function StatsCardsClient({
  totalOrphaned,
  uniqueMultiSubCustomers,
  totalRevenue,
  mahadCount,
  dugsiCount,
  onFilterClick,
}: StatsCardsClientProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card
        className={cn(
          'transition-all hover:shadow-md',
          onFilterClick && 'cursor-pointer hover:border-primary'
        )}
        onClick={() => onFilterClick?.({ type: 'status', value: 'ALL' })}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Orphaned</CardTitle>
          <Link2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalOrphaned}</div>
          <p className="text-xs text-muted-foreground">
            Subscriptions not linked to students
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'transition-all hover:shadow-md',
          onFilterClick && 'cursor-pointer hover:border-primary'
        )}
        onClick={() => onFilterClick?.({ type: 'status', value: 'ALL' })}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Multi-Subscription
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{uniqueMultiSubCustomers}</div>
          <p className="text-xs text-muted-foreground">
            Customers paying for multiple students
          </p>
        </CardContent>
      </Card>

      <Card className="transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalRevenue.toFixed(0)}</div>
          <p className="text-xs text-muted-foreground">
            Monthly revenue from orphaned subs
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'transition-all hover:shadow-md',
          onFilterClick && 'cursor-pointer hover:border-primary'
        )}
        onClick={() => onFilterClick?.({ type: 'program', value: 'MAHAD' })}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mahad Program</CardTitle>
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mahadCount}</div>
          <p className="text-xs text-muted-foreground">
            Mahad subscriptions to link
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'transition-all hover:shadow-md',
          onFilterClick && 'cursor-pointer hover:border-primary'
        )}
        onClick={() => onFilterClick?.({ type: 'program', value: 'DUGSI' })}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Dugsi Program</CardTitle>
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{dugsiCount}</div>
          <p className="text-xs text-muted-foreground">
            Dugsi subscriptions to link
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
