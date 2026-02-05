'use client'

import { useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import { Sun, Sunset, UserRoundX } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { ClassWithDetails, UnassignedStudent } from '../../_types'
import { bulkEnrollStudentsAction } from '../../actions'

type Sibling = UnassignedStudent['siblings'][number]

function formatSiblings(studentName: string, siblings: Sibling[]): string {
  const studentLast = studentName.split(' ').slice(1).join(' ')

  const groups = new Map<string, string[]>()
  for (const s of siblings) {
    const sibLast = s.name.split(' ').slice(1).join(' ')
    const displayName = sibLast === studentLast ? s.name.split(' ')[0] : s.name
    const shift = s.classShift === 'MORNING' ? 'AM' : 'PM'
    const key = `${s.teacherName}, ${shift}`
    const list = groups.get(key) ?? []
    list.push(displayName)
    groups.set(key, list)
  }

  let shown = 0
  const parts: string[] = []
  groups.forEach((names, key) => {
    if (shown >= 2) return
    const take = Math.min(names.length, 2 - shown)
    parts.push(`${names.slice(0, take).join(', ')} (${key})`)
    shown += take
  })

  const remaining = siblings.length - shown
  const suffix = remaining > 0 ? ` +${remaining} more` : ''

  return `${parts.join(', ')}${suffix}`
}

interface UnassignedStudentsSectionProps {
  students: UnassignedStudent[]
  classes: ClassWithDetails[]
}

export function UnassignedStudentsSection({
  students,
  classes,
}: UnassignedStudentsSectionProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [classId, setClassId] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sorted = useMemo(
    () =>
      [...students].sort((a, b) => {
        if (a.siblings.length !== b.siblings.length) {
          return b.siblings.length - a.siblings.length
        }
        return a.name.localeCompare(b.name)
      }),
    [students]
  )

  const allSelected = sorted.length > 0 && selected.size === sorted.length

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sorted.map((s) => s.profileId)))
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
  }

  const handleAssign = async () => {
    if (selected.size === 0 || !classId) return

    setIsLoading(true)
    try {
      const result = await bulkEnrollStudentsAction({
        classId,
        programProfileIds: Array.from(selected),
      })

      if (result.success) {
        toast.success(result.message || `Assigned ${selected.size} students`)
        setSelected(new Set())
        setClassId('')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const morningClasses = useMemo(
    () => classes.filter((c) => c.shift === 'MORNING'),
    [classes]
  )
  const afternoonClasses = useMemo(
    () => classes.filter((c) => c.shift === 'AFTERNOON'),
    [classes]
  )

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserRoundX className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">
            Unassigned Students ({students.length})
          </CardTitle>
        </div>
        <CardDescription>
          Select students and assign them to a class
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all students"
            />
            <span className="text-sm text-muted-foreground">
              {allSelected ? 'Deselect All' : 'Select All'}
            </span>
          </div>
          <ScrollArea className="h-64">
            {sorted.map((student) => (
              <label
                key={student.profileId}
                className="flex cursor-pointer items-start gap-3 px-3 py-1.5 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.has(student.profileId)}
                  onCheckedChange={() => toggle(student.profileId)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium">{student.name}</span>
                    {student.age !== null && (
                      <span className="text-muted-foreground">·</span>
                    )}
                    {student.age !== null && (
                      <span className="text-muted-foreground">
                        {student.age}
                      </span>
                    )}
                    <span className="text-muted-foreground">·</span>
                    {student.shift ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        {student.shift === 'MORNING' ? (
                          <Sun className="h-3 w-3" />
                        ) : (
                          <Sunset className="h-3 w-3" />
                        )}
                        {student.shift === 'MORNING' ? 'AM' : 'PM'}
                      </span>
                    ) : (
                      <span className="text-amber-600">No shift</span>
                    )}
                  </div>
                  {student.siblings.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {formatSiblings(student.name, student.siblings)}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </ScrollArea>
        </div>

        <div className="space-y-3">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {morningClasses.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Morning</SelectLabel>
                  {morningClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.studentCount} students)
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {afternoonClasses.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Afternoon</SelectLabel>
                  {afternoonClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.studentCount} students)
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          <Button
            className="w-full bg-[#007078] hover:bg-[#005a61]"
            disabled={selected.size === 0 || !classId || isLoading}
            onClick={handleAssign}
          >
            {isLoading
              ? 'Assigning...'
              : `Assign ${selected.size} Student${selected.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
