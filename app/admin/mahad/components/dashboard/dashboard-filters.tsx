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
import { StudentStatus } from '@/lib/types/student'

import { MahadBatch } from '../../_types'
import { useMahadFilters, useMahadUIStore } from '../../store'

interface DashboardFiltersProps {
  batches: MahadBatch[]
}

const STATUS_OPTIONS = [
  { value: StudentStatus.ENROLLED, label: 'Enrolled' },
  { value: StudentStatus.REGISTERED, label: 'Registered' },
  { value: StudentStatus.ON_LEAVE, label: 'On Leave' },
  { value: StudentStatus.WITHDRAWN, label: 'Withdrawn' },
]

export function DashboardFilters({ batches }: DashboardFiltersProps) {
  const filters = useMahadFilters()
  const { setSearchQuery, setBatchFilter, setStatusFilter, resetFilters } =
    useMahadUIStore()

  const hasFilters = filters.search || filters.batchId || filters.status

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
        value={filters.status ?? 'all'}
        onValueChange={(v) =>
          setStatusFilter(v === 'all' ? null : (v as StudentStatus))
        }
      >
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
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
