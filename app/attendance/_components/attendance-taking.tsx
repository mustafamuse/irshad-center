'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'

import { DugsiAttendanceStatus } from '@prisma/client'
import { format } from 'date-fns'
import { Loader2, Plus, Save, Lock, Users, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DugsiTeacherDTO } from '@/lib/db/queries/teacher'
import type {
  DugsiClassDTO,
  AttendanceSessionDTO,
  ClassStudentDTO,
  AttendanceRecordDTO,
} from '@/lib/types/dugsi-attendance'

import {
  getTodaysSessionAction,
  createSessionAction,
  getClassStudentsAction,
  getAttendanceRecordsAction,
  markAttendanceAction,
  closeSessionAction,
} from './actions'
import { AttendanceButton } from './attendance-button'

interface AttendanceTakingProps {
  classes: DugsiClassDTO[]
  teachers: DugsiTeacherDTO[]
}

type AttendanceChange = {
  programProfileId: string
  status: DugsiAttendanceStatus
}

export function AttendanceTaking({ classes, teachers }: AttendanceTakingProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [session, setSession] = useState<AttendanceSessionDTO | null>(null)
  const [students, setStudents] = useState<ClassStudentDTO[]>([])
  const [records, setRecords] = useState<AttendanceRecordDTO[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, AttendanceChange>
  >(new Map())

  const selectedClass = classes.find((c) => c.id === selectedClassId)

  useEffect(() => {
    if (selectedClassId) {
      loadSessionData()
    } else {
      setSession(null)
      setStudents([])
      setRecords([])
      setPendingChanges(new Map())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId])

  const loadSessionData = async () => {
    if (!selectedClassId) return

    setIsLoading(true)
    try {
      const [sessionResult, studentsResult] = await Promise.all([
        getTodaysSessionAction(selectedClassId),
        getClassStudentsAction(selectedClassId),
      ])

      if (sessionResult.success && sessionResult.data) {
        setSession(sessionResult.data)
        const recordsResult = await getAttendanceRecordsAction(
          sessionResult.data.id
        )
        if (recordsResult.success && recordsResult.data) {
          setRecords(recordsResult.data)
        }
      } else {
        setSession(null)
        setRecords([])
      }

      if (studentsResult.success && studentsResult.data) {
        setStudents(studentsResult.data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecordDTO>()
    records.forEach((r) => map.set(r.programProfileId, r))
    return map
  }, [records])

  const getEffectiveStatus = (
    programProfileId: string
  ): DugsiAttendanceStatus | null => {
    const pending = pendingChanges.get(programProfileId)
    if (pending) return pending.status
    const record = recordMap.get(programProfileId)
    return record?.status || null
  }

  const handleStatusChange = (
    programProfileId: string,
    status: DugsiAttendanceStatus
  ) => {
    const newChanges = new Map(pendingChanges)
    newChanges.set(programProfileId, { programProfileId, status })
    setPendingChanges(newChanges)
  }

  const handleSaveAll = async () => {
    if (!session || pendingChanges.size === 0) return

    startTransition(async () => {
      const result = await markAttendanceAction({
        sessionId: session.id,
        records: Array.from(pendingChanges.values()),
      })

      if (result.success && result.data) {
        toast.success(`Saved ${result.data.markedCount} student(s)`)
        setPendingChanges(new Map())
        loadSessionData()
      } else if (!result.success) {
        toast.error(result.error)
      }
    })
  }

  const handleMarkAllPresent = () => {
    const newChanges = new Map(pendingChanges)
    students.forEach((student) => {
      const existing = recordMap.get(student.programProfileId)
      if (!existing || existing.status !== DugsiAttendanceStatus.PRESENT) {
        newChanges.set(student.programProfileId, {
          programProfileId: student.programProfileId,
          status: DugsiAttendanceStatus.PRESENT,
        })
      }
    })
    setPendingChanges(newChanges)
  }

  const handleCreateSession = async () => {
    if (!selectedClassId || !selectedTeacherId) return

    startTransition(async () => {
      const result = await createSessionAction({
        classId: selectedClassId,
        teacherId: selectedTeacherId,
        date: new Date(),
      })

      if (result.success) {
        toast.success('Session started')
        setIsCreateDialogOpen(false)
        setSelectedTeacherId('')
        loadSessionData()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleCloseSession = async () => {
    if (!session) return

    startTransition(async () => {
      const result = await closeSessionAction(session.id)

      if (result.success) {
        toast.success('Session closed')
        loadSessionData()
      } else {
        toast.error(result.error)
      }
    })
  }

  const eligibleTeachers = teachers.filter(
    (t) =>
      !selectedClass ||
      t.shifts.includes(selectedClass.shift) ||
      t.shifts.length === 0
  )

  const hasChanges = pendingChanges.size > 0
  const presentCount = students.filter((s) => {
    const status = getEffectiveStatus(s.programProfileId)
    return (
      status === DugsiAttendanceStatus.PRESENT ||
      status === DugsiAttendanceStatus.LATE
    )
  }).length

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Select Class</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-base">
                  {c.name}
                  <span className="ml-2 text-muted-foreground">
                    ({c.shift === 'MORNING' ? 'Morning' : 'Afternoon'})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : selectedClassId && !session ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-center text-muted-foreground">
              No session started for {selectedClass?.name} today
            </p>
            <Button size="lg" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-5 w-5" />
              Start Session
            </Button>
          </CardContent>
        </Card>
      ) : session ? (
        <>
          {session.isClosed && (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                This session is closed and cannot be edited.
              </span>
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  <Users className="mr-2 inline h-5 w-5" />
                  {students.length} Students
                </CardTitle>
                <Badge variant="outline">
                  {presentCount} / {students.length} Present
                </Badge>
              </div>
              <CardDescription>{selectedClass?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!session.isClosed && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAllPresent}
                    disabled={isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark All Present
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {students.map((student) => {
                  const status = getEffectiveStatus(student.programProfileId)
                  const hasPendingChange = pendingChanges.has(
                    student.programProfileId
                  )

                  return (
                    <Card
                      key={student.programProfileId}
                      className={
                        hasPendingChange
                          ? 'border-yellow-300 bg-yellow-50/30'
                          : ''
                      }
                    >
                      <CardContent className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="font-medium">{student.studentName}</p>
                          {status && <StatusBadge status={status} />}
                        </div>
                        <AttendanceButton
                          status={status}
                          onStatusChange={(s) =>
                            handleStatusChange(student.programProfileId, s)
                          }
                          disabled={session.isClosed || isPending}
                          variant="mobile"
                        />
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {hasChanges && !session.isClosed && (
                <Button
                  size="lg"
                  className="h-14 w-full text-lg"
                  onClick={handleSaveAll}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-5 w-5" />
                  )}
                  Save ({pendingChanges.size} changes)
                </Button>
              )}

              {!session.isClosed && records.length > 0 && !hasChanges && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCloseSession}
                  disabled={isPending}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Close Session
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Start Attendance Session</DialogTitle>
            <DialogDescription>
              Select your name to start taking attendance for{' '}
              {selectedClass?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Teacher</label>
              <Select
                value={selectedTeacherId}
                onValueChange={setSelectedTeacherId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your name" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleTeachers.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No teachers available for this shift
                    </div>
                  ) : (
                    eligibleTeachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={!selectedTeacherId || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Start Session'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ status }: { status: DugsiAttendanceStatus }) {
  const config: Record<
    DugsiAttendanceStatus,
    {
      label: string
      variant: 'default' | 'secondary' | 'destructive' | 'outline'
    }
  > = {
    PRESENT: { label: 'Present', variant: 'default' },
    ABSENT: { label: 'Absent', variant: 'destructive' },
    LATE: { label: 'Late', variant: 'secondary' },
    EXCUSED: { label: 'Excused', variant: 'outline' },
  }

  const { label, variant } = config[status]

  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  )
}
