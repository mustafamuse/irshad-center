'use client'

import { useEffect, useState } from 'react'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  Search,
  GraduationCap,
  UserCheck,
  X,
  AlertTriangle,
} from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { getBatchesForFilter } from '../actions'

const studentStatuses = [
  {
    value: 'registered',
    label: 'Registered',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  },
  {
    value: 'enrolled',
    label: 'Enrolled',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  {
    value: 'withdrawn',
    label: 'Withdrawn',
    color:
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  },
]

export function StudentsTableFilters() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { replace } = useRouter()
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    getBatchesForFilter().then((result) => {
      if (result.success) {
        setBatches(result.data)
      }
    })
  }, [])

  const handleFilterChange = useDebouncedCallback(
    (value: string, name: string) => {
      const params = new URLSearchParams(searchParams)
      params.set('page', '1')
      if (value && value.toLowerCase() !== 'all') {
        params.set(name, value)
      } else {
        params.delete(name)
      }
      replace(`${pathname}?${params.toString()}`)
    },
    300
  )

  const clearAllFilters = () => {
    const params = new URLSearchParams()
    replace(`${pathname}?${params.toString()}`)
  }

  const applyNeedsBillingFilter = () => {
    const params = new URLSearchParams(searchParams)
    params.set('page', '1')
    params.set('needsBilling', 'true')
    // Clear other filters to focus on this specific filter
    params.delete('status')
    params.delete('batchId')
    params.delete('studentName')
    replace(`${pathname}?${params.toString()}`)
  }

  const hasActiveFilters =
    searchParams.get('studentName') ||
    searchParams.get('batchId') ||
    searchParams.get('status') ||
    searchParams.get('needsBilling')

  const needsBillingActive = searchParams.get('needsBilling') === 'true'

  return (
    <div className="space-y-4 bg-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              onChange={(e) =>
                handleFilterChange(e.target.value, 'studentName')
              }
              defaultValue={searchParams.get('studentName') || ''}
              className="border-border bg-background pl-10 text-foreground placeholder:text-muted-foreground"
              disabled={needsBillingActive}
            />
          </div>

          <div className="flex gap-2 sm:gap-4">
            <Select
              onValueChange={(value) => handleFilterChange(value, 'batchId')}
              defaultValue={searchParams.get('batchId') || 'all'}
              disabled={needsBillingActive}
            >
              <SelectTrigger className="w-[160px] border-border bg-background text-foreground sm:w-[200px]">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="All Batches" />
                </div>
              </SelectTrigger>
              <SelectContent className="border-border bg-background">
                <SelectItem value="all" className="text-foreground">
                  All Batches
                </SelectItem>
                {batches.map((batch) => (
                  <SelectItem
                    key={batch.id}
                    value={batch.id}
                    className="text-foreground"
                  >
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              onValueChange={(value) => handleFilterChange(value, 'status')}
              defaultValue={searchParams.get('status') || 'all'}
              disabled={needsBillingActive}
            >
              <SelectTrigger className="w-[150px] border-border bg-background text-foreground sm:w-[180px]">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="All Statuses" />
                </div>
              </SelectTrigger>
              <SelectContent className="border-border bg-background">
                <SelectItem value="all" className="text-foreground">
                  All Statuses
                </SelectItem>
                {studentStatuses.map((status) => (
                  <SelectItem
                    key={status.value}
                    value={status.value}
                    className="text-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${status.color}`} />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={needsBillingActive ? 'default' : 'outline'}
            onClick={applyNeedsBillingFilter}
            className={`flex w-full items-center gap-2 sm:w-auto ${
              needsBillingActive
                ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600'
                : 'border-border bg-background text-foreground hover:bg-accent'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Needs Billing Setup
          </Button>

          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={clearAllFilters}
              className="flex w-full items-center gap-2 border-border bg-background text-foreground hover:bg-accent sm:w-auto"
            >
              <X className="h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 bg-card">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {needsBillingActive && (
            <Badge
              variant="default"
              className="gap-1 border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-900 dark:text-orange-300"
            >
              <AlertTriangle className="h-3 w-3" />
              Needs billing setup
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleFilterChange('', 'needsBilling')}
              />
            </Badge>
          )}
          {searchParams.get('studentName') && !needsBillingActive && (
            <Badge
              variant="secondary"
              className="gap-1 border-border bg-muted text-muted-foreground"
            >
              Name: {searchParams.get('studentName')}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleFilterChange('', 'studentName')}
              />
            </Badge>
          )}
          {searchParams.get('batchId') && !needsBillingActive && (
            <Badge
              variant="secondary"
              className="gap-1 border-border bg-muted text-muted-foreground"
            >
              Batch:{' '}
              {batches.find((b) => b.id === searchParams.get('batchId'))
                ?.name || 'Unknown'}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleFilterChange('', 'batchId')}
              />
            </Badge>
          )}
          {searchParams.get('status') && !needsBillingActive && (
            <Badge
              variant="secondary"
              className="gap-1 border-border bg-muted text-muted-foreground"
            >
              Status:{' '}
              {studentStatuses.find(
                (s) => s.value === searchParams.get('status')
              )?.label || 'Unknown'}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleFilterChange('', 'status')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
