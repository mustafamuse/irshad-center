'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

import { format } from 'date-fns'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Student {
  id: string
  name: string
  email: string
  rollNumber?: string // Add roll numbers for easier reference
}

interface AttendanceMarkingProps {
  date: Date
  batchId: string
  onBackAction: () => void // Renamed to indicate it's a server action
}

export function AttendanceMarking({
  date,
  batchId,
  onBackAction,
}: AttendanceMarkingProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMoreActions, setShowMoreActions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const moreActionsRef = useRef<HTMLDivElement>(null)

  // Close more actions menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        moreActionsRef.current &&
        !moreActionsRef.current.contains(event.target as Node)
      ) {
        setShowMoreActions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const moveSelection = useCallback(
    (delta: number) => {
      setSelectedStudentIndex((prev) => {
        const next = prev + delta
        return Math.max(0, Math.min(next, students.length - 1))
      })
    },
    [students.length]
  )

  const handleAttendanceChange = useCallback(
    (studentId: string, status: string) => {
      setAttendance((prev) => ({
        ...prev,
        [studentId]: status,
      }))
    },
    []
  )

  const handleQuickMark = useCallback(
    (status: string) => {
      if (students[selectedStudentIndex]) {
        handleAttendanceChange(students[selectedStudentIndex].id, status)
        moveSelection(1) // Move to next student automatically
      }
    },
    [selectedStudentIndex, students, handleAttendanceChange, moveSelection]
  )

  // Keyboard shortcuts for quick attendance marking
  useHotkeys('p', () => handleQuickMark('present'), [handleQuickMark])
  useHotkeys('a', () => handleQuickMark('absent'), [handleQuickMark])
  useHotkeys('l', () => handleQuickMark('late'), [handleQuickMark])
  useHotkeys('e', () => handleQuickMark('excused'), [handleQuickMark])
  useHotkeys('ArrowDown', () => moveSelection(1), [moveSelection])
  useHotkeys('ArrowUp', () => moveSelection(-1), [moveSelection])
  useHotkeys('/', () => searchInputRef.current?.focus(), [])

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.rollNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    async function fetchStudents() {
      try {
        const response = await fetch(`/api/batches/${batchId}/students`)
        const data = await response.json()
        console.log('API Response:', { batchId, data })
        if (data.success) {
          setStudents(data.data)
          // Initialize attendance status for all students as 'absent'
          const initialAttendance: Record<string, string> = {}
          data.data.forEach((student: Student) => {
            initialAttendance[student.id] = 'absent'
          })
          setAttendance(initialAttendance)
        } else {
          toast.error('Failed to load students')
        }
      } catch {
        toast.error('Error loading students')
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [batchId])

  // Removed duplicate handleAttendanceChange function

  const handleSave = async () => {
    // Check if any students are unmarked
    const unmarkedStudents = students.filter((s) => !attendance[s.id])
    if (unmarkedStudents.length > 0) {
      const proceed = window.confirm(
        `${unmarkedStudents.length} student(s) are unmarked. They will be marked as absent. Continue?`
      )
      if (!proceed) return

      // Mark remaining students as absent
      unmarkedStudents.forEach((s) => {
        attendance[s.id] = 'absent'
      })
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/attendance/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: date.toISOString(),
          batchId,
          attendance: Object.entries(attendance).map(([studentId, status]) => ({
            studentId,
            status,
          })),
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Attendance saved successfully', {
          description: `Marked attendance for ${students.length} students`,
          action: {
            label: 'View Summary',
            onClick: () => {
              const summary = {
                present: Object.values(attendance).filter(
                  (s) => s === 'present'
                ).length,
                absent: Object.values(attendance).filter((s) => s === 'absent')
                  .length,
                late: Object.values(attendance).filter((s) => s === 'late')
                  .length,
                excused: Object.values(attendance).filter(
                  (s) => s === 'excused'
                ).length,
              }
              toast.info('Attendance Summary', {
                description: `Present: ${summary.present}, Absent: ${summary.absent}, Late: ${summary.late}, Excused: ${summary.excused}`,
                duration: 5000,
              })
            },
          },
        })
        onBackAction()
      } else {
        throw new Error(data.error || 'Failed to save attendance')
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save attendance',
        {
          description:
            'Please try again or contact support if the issue persists',
          action: {
            label: 'Try Again',
            onClick: () => handleSave(),
          },
        }
      )
    } finally {
      setSaving(false)
    }
  }

  const handleMarkAll = (status: string) => {
    const newAttendance = { ...attendance }
    students.forEach((student) => {
      newAttendance[student.id] = status
    })
    setAttendance(newAttendance)
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 sm:flex sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button variant="outline" onClick={onBackAction} className="w-fit">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Mark Attendance</h2>
            <p className="text-muted-foreground">{format(date, 'PPPP')}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleMarkAll('present')}
              className="flex-1 sm:flex-none"
            >
              <span className="hidden sm:inline">Mark All </span>Present
            </Button>
            <Button
              variant="outline"
              onClick={() => handleMarkAll('absent')}
              className="flex-1 sm:flex-none"
            >
              <span className="hidden sm:inline">Mark All </span>Absent
            </Button>
            <div className="relative">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => setShowMoreActions(!showMoreActions)}
              >
                More
              </Button>
              {showMoreActions && (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                  <div className="py-1">
                    <button
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => {
                        const unmarkedStudents = students.filter(
                          (s) => !attendance[s.id]
                        )
                        unmarkedStudents.forEach((s) =>
                          handleAttendanceChange(s.id, 'present')
                        )
                        setShowMoreActions(false)
                      }}
                    >
                      Mark Remaining as Present
                    </button>
                    <button
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => {
                        const unmarkedStudents = students.filter(
                          (s) => !attendance[s.id]
                        )
                        unmarkedStudents.forEach((s) =>
                          handleAttendanceChange(s.id, 'absent')
                        )
                        setShowMoreActions(false)
                      }}
                    >
                      Mark Remaining as Absent
                    </button>
                    <button
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => {
                        setAttendance({})
                        setShowMoreActions(false)
                      }}
                    >
                      Clear All Marks
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Attendance
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Keyboard Shortcuts */}
        <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2 font-medium">Keyboard Shortcuts</p>
            <div className="xs:grid-cols-2 grid grid-cols-1 gap-2">
              <div className="flex items-center">
                <kbd className="min-w-[32px] rounded bg-muted px-2 py-1 text-center">
                  P
                </kbd>
                <span className="ml-2">Mark Present</span>
              </div>
              <div className="flex items-center">
                <kbd className="min-w-[32px] rounded bg-muted px-2 py-1 text-center">
                  A
                </kbd>
                <span className="ml-2">Mark Absent</span>
              </div>
              <div className="flex items-center">
                <kbd className="min-w-[32px] rounded bg-muted px-2 py-1 text-center">
                  L
                </kbd>
                <span className="ml-2">Mark Late</span>
              </div>
              <div className="flex items-center">
                <kbd className="min-w-[32px] rounded bg-muted px-2 py-1 text-center">
                  E
                </kbd>
                <span className="ml-2">Mark Excused</span>
              </div>
              <div className="flex items-center">
                <kbd className="min-w-[32px] rounded bg-muted px-2 py-1 text-center">
                  ↑/↓
                </kbd>
                <span className="ml-2">Navigate</span>
              </div>
              <div className="flex items-center">
                <kbd className="min-w-[32px] rounded bg-muted px-2 py-1 text-center">
                  /
                </kbd>
                <span className="ml-2">Search</span>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <div className="text-sm">
            <p className="mb-2 font-medium">Attendance Summary</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground">Present</p>
                <p className="text-2xl font-bold">
                  {
                    Object.values(attendance).filter(
                      (status) => status === 'present'
                    ).length
                  }
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Absent</p>
                <p className="text-2xl font-bold">
                  {
                    Object.values(attendance).filter(
                      (status) => status === 'absent'
                    ).length
                  }
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Late</p>
                <p className="text-2xl font-bold">
                  {
                    Object.values(attendance).filter(
                      (status) => status === 'late'
                    ).length
                  }
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Excused</p>
                <p className="text-2xl font-bold">
                  {
                    Object.values(attendance).filter(
                      (status) => status === 'excused'
                    ).length
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search students..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border px-4 py-2"
        />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle>Students ({filteredStudents.length})</CardTitle>
            <p className="text-sm text-muted-foreground">
              {Object.keys(attendance).length} of {students.length} marked
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 ease-in-out"
              style={{
                width: `${(Object.keys(attendance).length / students.length) * 100}%`,
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredStudents.map((student, index) => (
              <div
                key={student.id}
                className={`flex flex-col items-start justify-between rounded-lg border p-4 sm:flex-row sm:items-center ${
                  index === selectedStudentIndex ? 'bg-muted' : ''
                }`}
                onClick={() => setSelectedStudentIndex(index)}
              >
                <div className="mb-4 flex-1 sm:mb-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">
                      #{String(index + 1).padStart(2, '0')}
                    </span>
                    <p className="font-medium">{student.name}</p>
                    {attendance[student.id] && (
                      <span
                        className={cn('rounded-full px-2 py-0.5 text-xs', {
                          'bg-green-100 text-green-700':
                            attendance[student.id] === 'present',
                          'bg-red-100 text-red-700':
                            attendance[student.id] === 'absent',
                          'bg-yellow-100 text-yellow-700':
                            attendance[student.id] === 'late',
                          'bg-blue-100 text-blue-700':
                            attendance[student.id] === 'excused',
                        })}
                      >
                        {attendance[student.id].charAt(0).toUpperCase() +
                          attendance[student.id].slice(1)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {student.email}
                  </p>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <div className="grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto">
                    <Button
                      size="sm"
                      variant={
                        attendance[student.id] === 'present'
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() =>
                        handleAttendanceChange(student.id, 'present')
                      }
                      className="w-full sm:w-10"
                    >
                      P
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        attendance[student.id] === 'absent'
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() =>
                        handleAttendanceChange(student.id, 'absent')
                      }
                      className="w-full sm:w-10"
                    >
                      A
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        attendance[student.id] === 'late'
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() => handleAttendanceChange(student.id, 'late')}
                      className="w-full sm:w-10"
                    >
                      L
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        attendance[student.id] === 'excused'
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() =>
                        handleAttendanceChange(student.id, 'excused')
                      }
                      className="w-full sm:w-10"
                    >
                      E
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
