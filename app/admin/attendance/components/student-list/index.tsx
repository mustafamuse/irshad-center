'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAttendance } from '@/app/admin/attendance/_hooks/use-attendance'
import { StudentRow } from './student-row'
import { StudentListHeader } from './student-list-header'
import { StudentListSkeleton } from '../skeletons'
import { useStudents } from '../../_hooks/use-attendance-queries'
import type { Student } from '../../_types'
import { cn } from '@/lib/utils'

/**
 * StudentList component displays a virtualized list of students with search and attendance marking capabilities.
 *
 * @example
 * ```tsx
 * <StudentList batchId="batch-123" />
 * ```
 *
 * Features:
 * - Virtualized scrolling for performance
 * - Search functionality
 * - Attendance marking
 * - Loading and error states
 * - Keyboard navigation
 */
interface StudentListProps {
  /** The ID of the batch to display students for */
  batchId: string
}

export function StudentList({ batchId }: StudentListProps) {
  // 1. Hooks (ordered by dependency)
  const {
    searchQuery,
    setSearchQuery,
    selectedStudentIndex,
    setSelectedStudentIndex,
    handleAttendanceChange,
    attendance,
  } = useAttendance()

  const { data: students, isLoading, error } = useStudents(batchId)
  const parentRef = useRef<HTMLDivElement>(null)

  // 2. Memoized values
  const filteredStudents = useMemo(() => {
    if (!students) return []
    if (!searchQuery) return students
    const query = searchQuery.toLowerCase()
    return students.filter((student) =>
      student.name.toLowerCase().includes(query)
    )
  }, [students, searchQuery])

  const rowVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 80, []),
    overscan: 5,
  })

  const virtualRows = useMemo(
    () => rowVirtualizer.getVirtualItems(),
    [rowVirtualizer]
  )

  // 3. Event Handlers
  const handleStudentClick = useCallback(
    (index: number) => {
      setSelectedStudentIndex(index)
    },
    [setSelectedStudentIndex]
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    [setSearchQuery]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedStudentIndex((prev) =>
          Math.min(prev + 1, filteredStudents.length - 1)
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedStudentIndex((prev) => Math.max(prev - 1, 0))
      }
    },
    [setSelectedStudentIndex, filteredStudents.length]
  )

  const renderRow = useCallback(
    (virtualRow: { index: number; start: number }, student: Student) => (
      <div
        key={student.id}
        data-index={virtualRow.index}
        ref={rowVirtualizer.measureElement}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualRow.start}px)`,
        }}
      >
        <StudentRow
          student={student}
          index={virtualRow.index}
          isSelected={virtualRow.index === selectedStudentIndex}
          onSelect={handleStudentClick}
          onAttendanceChange={handleAttendanceChange}
          currentStatus={attendance[student.id]}
        />
      </div>
    ),
    [
      selectedStudentIndex,
      handleStudentClick,
      handleAttendanceChange,
      attendance,
      rowVirtualizer.measureElement,
    ]
  )

  const headerProps = useMemo(
    () => ({
      totalCount: filteredStudents.length,
      markedCount: Object.keys(attendance).length,
    }),
    [filteredStudents.length, attendance]
  )

  // 4. Early returns
  if (isLoading) {
    return <StudentListSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardContent className={cn('p-6 text-center', 'space-y-2')}>
          <p className="text-destructive">Failed to load students</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!students?.length) {
    return (
      <Card>
        <CardContent className={cn('p-6 text-center', 'text-muted-foreground')}>
          No students found in this batch
        </CardContent>
      </Card>
    )
  }

  // 5. Render
  return (
    <Card>
      <StudentListHeader {...headerProps} />
      <CardContent className="p-0">
        <div className="p-4">
          <Input
            type="text"
            placeholder="Search students by name..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            aria-label="Search students"
            className="w-full"
          />
        </div>

        <div
          ref={parentRef}
          className={cn(
            // Layout
            'relative',
            // Dimensions
            'h-[400px]',
            // Behavior
            'overflow-auto',
            // Accessibility
            'focus:outline-none focus:ring-2 focus:ring-primary'
          )}
          tabIndex={0}
          role="list"
          aria-label="Student list"
        >
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: 'relative',
            }}
            role="presentation"
          >
            {virtualRows.map((virtualRow) =>
              renderRow(virtualRow, filteredStudents[virtualRow.index])
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
