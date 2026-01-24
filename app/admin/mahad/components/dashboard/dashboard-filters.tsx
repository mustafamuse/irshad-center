'use client'

import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { MahadBatch, PaymentHealth } from '../../_types'
import { useMahadFilters, useMahadUIStore } from '../../store'

interface DashboardFiltersProps {
  batches: MahadBatch[]
}

const PAYMENT_HEALTH_OPTIONS: { value: PaymentHealth; label: string }[] = [
  { value: 'needs_action', label: 'Needs Action' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'exempt', label: 'Exempt' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
]

export function DashboardFilters({ batches }: DashboardFiltersProps) {
  const filters = useMahadFilters()
  const {
    setSearchQuery,
    setBatchFilter,
    setPaymentHealthFilter,
    resetFilters,
  } = useMahadUIStore()

  const hasFilters = filters.search || filters.batchId || filters.paymentHealth

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search students..."
          value={filters.search}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select
        value={filters.batchId ?? 'all'}
        onValueChange={(v) => setBatchFilter(v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Batches" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Batches</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {batches.map((batch) => (
            <SelectItem key={batch.id} value={batch.id}>
              {batch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.paymentHealth ?? 'all'}
        onValueChange={(v) =>
          setPaymentHealthFilter(v === 'all' ? null : (v as PaymentHealth))
        }
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Payment Health" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Payment Status</SelectItem>
          {PAYMENT_HEALTH_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
