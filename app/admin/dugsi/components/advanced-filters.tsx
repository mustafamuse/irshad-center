'use client'

import { useMemo, useState } from 'react'

import { format } from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { FamilyFilters, DugsiRegistration } from '../_types'

export function AdvancedFilters({
  filters,
  onFiltersChange,
  registrations,
}: AdvancedFiltersProps) {
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: filters.dateRange?.start,
    to: filters.dateRange?.end,
  })

  // Extract unique schools and grades
  const { schools, grades } = useMemo(() => {
    const schoolSet = new Set<string>()
    const gradeSet = new Set<string>()

    registrations.forEach((reg) => {
      if (reg.schoolName) schoolSet.add(reg.schoolName)
      if (reg.gradeLevel) gradeSet.add(reg.gradeLevel)
    })

    return {
      schools: Array.from(schoolSet).sort(),
      grades: Array.from(gradeSet).sort(),
    }
  }, [registrations])

  const handleDateChange = () => {
    if (dateRange.from && dateRange.to) {
      onFiltersChange({
        ...filters,
        dateRange: { start: dateRange.from, end: dateRange.to },
      })
    }
  }

  const clearDateRange = () => {
    setDateRange({ from: undefined, to: undefined })
    onFiltersChange({ ...filters, dateRange: null })
  }

  const toggleSchool = (school: string) => {
    const newSchools = filters.schools.includes(school)
      ? filters.schools.filter((s) => s !== school)
      : [...filters.schools, school]
    onFiltersChange({ ...filters, schools: newSchools })
  }

  const toggleGrade = (grade: string) => {
    const newGrades = filters.grades.includes(grade)
      ? filters.grades.filter((g) => g !== grade)
      : [...filters.grades, grade]
    onFiltersChange({ ...filters, grades: newGrades })
  }

  const clearAllFilters = () => {
    setDateRange({ from: undefined, to: undefined })
    onFiltersChange({
      dateRange: null,
      schools: [],
      grades: [],
      hasHealthInfo: false,
    })
  }

  const hasActiveFilters =
    filters.dateRange ||
    filters.schools.length > 0 ||
    filters.grades.length > 0 ||
    filters.hasHealthInfo

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Advanced Filters</h3>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs"
            >
              Clear All
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label className="text-xs">Registration Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dateRange.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'LLL dd, y')} -{' '}
                        {format(dateRange.to, 'LLL dd, y')}
                      </>
                    ) : (
                      format(dateRange.from, 'LLL dd, y')
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{
                    from: dateRange.from,
                    to: dateRange.to,
                  }}
                  onSelect={(range) => {
                    if (range) {
                      setDateRange({ from: range.from, to: range.to })
                      if (range.from && range.to) {
                        handleDateChange()
                      }
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {filters.dateRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateRange}
                className="h-6 text-xs"
              >
                <X className="mr-1 h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          {/* School Filter */}
          <div className="space-y-2">
            <Label className="text-xs">School</Label>
            <Select
              value={filters.schools[0] || 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  onFiltersChange({ ...filters, schools: [] })
                } else {
                  onFiltersChange({ ...filters, schools: [value] })
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select school" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {schools.map((school) => (
                  <SelectItem key={school} value={school}>
                    {school}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.schools.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filters.schools.map((school) => (
                  <Badge
                    key={school}
                    variant="secondary"
                    className="cursor-pointer text-xs"
                    onClick={() => toggleSchool(school)}
                  >
                    {school}
                    <X className="ml-1 h-2.5 w-2.5" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Grade Filter */}
          <div className="space-y-2">
            <Label className="text-xs">Grade Level</Label>
            <Select
              value={filters.grades[0] || 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  onFiltersChange({ ...filters, grades: [] })
                } else {
                  onFiltersChange({ ...filters, grades: [value] })
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    Grade {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.grades.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filters.grades.map((grade) => (
                  <Badge
                    key={grade}
                    variant="secondary"
                    className="cursor-pointer text-xs"
                    onClick={() => toggleGrade(grade)}
                  >
                    Grade {grade}
                    <X className="ml-1 h-2.5 w-2.5" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Health Info Filter */}
          <div className="space-y-2">
            <Label className="text-xs">Other Filters</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="health-info"
                  checked={filters.hasHealthInfo}
                  onCheckedChange={(checked) =>
                    onFiltersChange({
                      ...filters,
                      hasHealthInfo: !!checked,
                    })
                  }
                />
                <label
                  htmlFor="health-info"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Has health information
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Active:</span>
              <div className="flex flex-wrap gap-1">
                {filters.dateRange && (
                  <Badge variant="outline" className="text-xs">
                    {format(filters.dateRange.start, 'MMM d')} -{' '}
                    {format(filters.dateRange.end, 'MMM d')}
                  </Badge>
                )}
                {filters.schools.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {filters.schools.length} school(s)
                  </Badge>
                )}
                {filters.grades.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {filters.grades.length} grade(s)
                  </Badge>
                )}
                {filters.hasHealthInfo && (
                  <Badge variant="outline" className="text-xs">
                    Health alerts
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
